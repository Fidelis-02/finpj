const { salvarDiagnostico, obterUsuario, salvarUsuario } = require('../services/database');
const { gerarAnaliseFinanceira } = require('../services/aiService');
const { fetchNotasFiscais, calcularDasAutomatico } = require('../services/nfeService');
const { getFiscalSimulation } = require('../services/fiscalCache');
const { getScopedCompanyRecord, attachCompanyScope } = require('../services/companyContext');
const taxUtils = require('../tax/utils');

const taxEngine = require('../tax/index');
const verificarNcmMonofasico = taxEngine.verificarNcmMonofasico;

function inferActivity(setor = '') {
    return taxUtils.normalizeActivity(setor || 'comercio');
}

async function calcularDas(req, res) {
    const { faturamento, margem, regime, atividade } = req.body;
    const fat = taxUtils.parseNumber(faturamento);
    const marg = taxUtils.parseMargin(margem);
    if (!Number.isFinite(fat) || fat <= 0) return res.status(400).json({ erro: 'Informe o faturamento.' });
    if (!Number.isFinite(marg) || marg < 0 || marg > 1) return res.status(400).json({ erro: 'Informe uma margem entre 0% e 100%.' });

    let simulation;
    try {
        simulation = getFiscalSimulation({
            annualRevenue: fat,
            margin: marg,
            activity: inferActivity(atividade)
        }).simulation;
    } catch (error) {
        return res.status(400).json({ erro: error.message });
    }

    const regimeKey = taxUtils.normalizeRegime(regime || 'simples') || 'simples';
    const selected = simulation.regimes.find((item) => item.key === regimeKey);
    if (!selected || selected.eligible === false) {
        return res.status(400).json({ erro: selected?.reason || 'Regime nao aplicavel aos dados informados.' });
    }

    const hoje = new Date();
    const proxMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 20);
    const guia = selected.key === 'simples' ? 'DAS' : 'DARF';
    return res.json({
        sucesso: true,
        guia,
        valor: Math.round(selected.monthlyTax),
        valorAnual: Math.round(selected.annualTax),
        aliquotaEfetiva: (selected.effectiveRate * 100).toFixed(2),
        vencimento: proxMes.toISOString().slice(0, 10),
        faturamentoMensal: Math.round(fat / 12),
        regime: selected.name,
        detalhamento: selected.breakdown
    });
}

function fiscalCalendar(req, res) {
    const hoje = new Date();
    const anoSelecionado = parseInt(req.query.ano, 10) || hoje.getFullYear();
    const eventos = [];
    const templateEventos = [
        { dia: 7, titulo: 'FGTS', desc: 'Recolhimento do FGTS', tipo: 'imposto' },
        { dia: 10, titulo: 'GPS/INSS', desc: 'Guia da Previdencia Social', tipo: 'imposto' },
        { dia: 15, titulo: 'ISS', desc: 'Imposto Sobre Servicos (municipal)', tipo: 'imposto' },
        { dia: 20, titulo: 'DAS', desc: 'Documento de Arrecadacao do Simples Nacional', tipo: 'imposto' },
        { dia: 20, titulo: 'IRRF', desc: 'Imposto de Renda Retido na Fonte', tipo: 'imposto' },
        { dia: 25, titulo: 'PIS/COFINS', desc: 'Contribuicao PIS e COFINS', tipo: 'imposto' },
        { dia: 25, titulo: 'ICMS', desc: 'Imposto sobre Circulacao de Mercadorias', tipo: 'imposto' },
        { dia: 28, titulo: 'CSLL', desc: 'Contribuicao Social sobre o Lucro Liquido', tipo: 'imposto' },
        { dia: 1, titulo: 'Folha', desc: 'Processamento da folha de pagamento', tipo: 'rh' },
        { dia: 5, titulo: 'Pro-labore', desc: 'Pagamento de pro-labore aos socios', tipo: 'rh' },
        { dia: 30, titulo: 'Balanco', desc: 'Fechamento contabil mensal', tipo: 'contabil' }
    ];

    for (let mes = 0; mes < 12; mes += 1) {
        templateEventos.forEach((evento) => {
            const dataEvento = new Date(anoSelecionado, mes, evento.dia);
            eventos.push({
                ...evento,
                mes,
                data: dataEvento.toISOString().slice(0, 10),
                passado: dataEvento < hoje
            });
        });
    }

    return res.json({ sucesso: true, eventos, ano: anoSelecionado });
}

async function postDiagnostico(req, res) {
    const { nome, cnpj, setor, regime, faturamento, margem, ncm } = req.body;
    const usuario = req.userEmail ? await obterUsuario(req.userEmail) : null;
    const scoped = usuario ? getScopedCompanyRecord(usuario, req.body?.companyId) : null;
    const resolvedNome = nome || scoped?.snapshot?.fantasia || scoped?.snapshot?.nome || '';
    const resolvedCnpj = String(cnpj || scoped?.snapshot?.cnpj || '').replace(/\D/g, '');
    const resolvedSetor = setor || scoped?.snapshot?.setor || '';
    const resolvedRegime = regime || scoped?.snapshot?.regime || '';

    if (!resolvedNome || !resolvedCnpj) {
        return res.status(400).json({ erro: 'Nome e CNPJ sao obrigatorios.' });
    }

    const fat = taxUtils.parseNumber(faturamento);
    const marg = taxUtils.parseMargin(margem);
    if (!Number.isFinite(fat) || fat <= 0) {
        return res.status(400).json({ erro: 'Informe o faturamento anual.' });
    }
    if (!Number.isFinite(marg) || marg < 0 || marg > 1) {
        return res.status(400).json({ erro: 'Informe uma margem entre 0% e 100%.' });
    }

    let simulation;
    try {
        simulation = getFiscalSimulation({
            annualRevenue: fat,
            margin: marg,
            activity: inferActivity(resolvedSetor)
        }).simulation;
    } catch (error) {
        return res.status(400).json({ erro: error.message });
    }

    const best = simulation.bestRegime;
    const economia = simulation.savingsComparedToWorst?.annual || 0;
    let creditosIdentificados = 0;
    let ncmInfo = null;
    const alertasNcm = [];

    if (ncm && ncm.trim() !== '') {
        ncmInfo = verificarNcmMonofasico(ncm);

        if (ncmInfo && ncmInfo.isMonofasico) {
            const parcelaMonofasica = fat * 0.3;
            creditosIdentificados = parcelaMonofasica * ncmInfo.aliquotas.total;
            alertasNcm.push(`NCM ${ncmInfo.codigo} (${ncmInfo.categoriaDescricao}) possui tributacao monofasica.`);
        }
    }

    const impostos = simulation.regimes.reduce((acc, item) => {
        acc[item.key] = item.annualTax == null ? null : Math.round(item.annualTax);
        return acc;
    }, {});

    const diagnostico = attachCompanyScope({
        id: `diag_${Date.now()}`,
        nome: resolvedNome,
        cnpj: resolvedCnpj,
        ownerEmail: req.userEmail || null,
        setor: resolvedSetor,
        regime: resolvedRegime,
        ncm: ncm || '',
        faturamento: fat,
        margem: marg,
        data: new Date().toISOString(),
        resultados: {
            regimeIdeal: best.name,
            impostoIdeal: Math.round(best.annualTax),
            economia: Math.round(economia),
            creditosIdentificados: Math.round(creditosIdentificados),
            ncmAnalise: ncmInfo ? {
                codigo: ncmInfo.codigo,
                descricao: ncmInfo.descricao,
                categoria: ncmInfo.categoria,
                isMonofasico: ncmInfo.isMonofasico,
                aliquotaTotal: ncmInfo.aliquotas?.total
            } : null,
            alertasNcm: alertasNcm.length > 0 ? alertasNcm : undefined,
            anomaliaValor: 0,
            impostos,
            regimes: simulation.regimes,
            premissas: simulation.assumptions
        }
    }, scoped);

    const analise = await gerarAnaliseFinanceira(diagnostico);
    diagnostico.resultados = {
        ...diagnostico.resultados,
        resumo: analise.resumo,
        recomendacoes: analise.recomendacoes
    };

    await salvarDiagnostico(diagnostico);
    return res.json({ sucesso: true, id: diagnostico.id, resultados: diagnostico.resultados });
}

async function gerarDasAutomatico(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario || !usuario.cnpj) {
        return res.status(400).json({ erro: 'Usuario sem CNPJ cadastrado para buscar notas fiscais.' });
    }

    const dadosNfe = await fetchNotasFiscais(usuario.cnpj);
    const das = calcularDasAutomatico(dadosNfe.resumo.faturamento);

    if (!usuario.impostosEmitidos) usuario.impostosEmitidos = [];
    usuario.impostosEmitidos.push({
        ...das,
        faturamentoBase: dadosNfe.resumo.faturamento,
        emitidoEm: new Date().toISOString()
    });
    await salvarUsuario(usuario);

    return res.json({
        sucesso: true,
        nfe: dadosNfe,
        das
    });
}

module.exports = {
    calcularDas,
    fiscalCalendar,
    postDiagnostico,
    gerarDasAutomatico
};
