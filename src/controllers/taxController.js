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
    if (!Number.isFinite(fat) || fat <= 0) return res.status(422).json({ erro: 'Informe o faturamento.' });
    if (!Number.isFinite(marg) || marg < 0 || marg > 1) return res.status(422).json({ erro: 'Informe uma margem entre 0% e 100%.' });

    let monofasicoRevenue = 0;
    if (req.body.produtos && Array.isArray(req.body.produtos)) {
        const impacto = taxEngine.calcularImpactoMonofasico(req.body.produtos);
        monofasicoRevenue = impacto.valorMonofasico || 0;
    }

    let simulation;
    try {
        simulation = getFiscalSimulation({
            annualRevenue: fat,
            margin: marg,
            activity: inferActivity(atividade),
            monofasicoRevenue
        }).simulation;
    } catch (error) {
        return res.status(422).json({ erro: error.message });
    }

    const regimeKey = taxUtils.normalizeRegime(regime || 'simples') || 'simples';
    const selected = simulation.regimes.find((item) => item.key === regimeKey);
    if (!selected || selected.eligible === false) {
        return res.status(422).json({ erro: selected?.reason || 'Regime nao aplicavel aos dados informados.' });
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

    let monofasicoRevenue = 0;
    let analiseMonofasica = null;

    if (req.body.produtos && Array.isArray(req.body.produtos)) {
        analiseMonofasica = taxEngine.calcularImpactoMonofasico(req.body.produtos);
        monofasicoRevenue = analiseMonofasica.valorMonofasico || 0;
    }

    let simulation;
    try {
        simulation = getFiscalSimulation({
            annualRevenue: fat,
            margin: marg,
            activity: inferActivity(resolvedSetor),
            monofasicoRevenue
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

    if (analiseMonofasica && analiseMonofasica.produtosMonofasicos > 0) {
        creditosIdentificados += analiseMonofasica.creditosNãoAproveitados || 0;
        alertasNcm.push(...(analiseMonofasica.alertas || []));
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

    let analise;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 15000));
        analise = await Promise.race([gerarAnaliseFinanceira(diagnostico), timeout]);
    } catch (error) {
        if (error.message === 'TIMEOUT') {
            return res.status(504).json({ erro: 'O tempo limite da análise de IA foi excedido. Tente novamente.', status: 504 });
        }
        console.warn('Erro na análise de IA:', error.message);
        analise = { resumo: 'Análise indisponível no momento.', recomendacoes: [] };
    }

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

    let dadosNfe;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 20000));
        dadosNfe = await Promise.race([fetchNotasFiscais(usuario.cnpj), timeout]);
    } catch (error) {
        if (error.message === 'TIMEOUT') {
            return res.status(504).json({ erro: 'O tempo limite ao buscar notas fiscais foi excedido. A Sefaz pode estar instável.', status: 504 });
        }
        return res.status(502).json({ erro: 'Falha ao comunicar com os sistemas fiscais.', detalhes: error.message, status: 502 });
    }

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

async function simulate(req, res) {
    const { annualRevenue, margin, payroll, activity } = req.body;

    const fat = taxUtils.parseNumber(annualRevenue);
    const marg = taxUtils.parseNumber(margin);
    const folha = taxUtils.parseNumber(payroll ?? 0);

    // Input validation
    if (annualRevenue === undefined || isNaN(fat) || fat <= 0) {
        return res.status(400).json({ erro: 'O faturamento anual deve ser um número maior que zero.' });
    }
    if (margin === undefined || isNaN(marg) || marg < 0 || marg > 100) {
        return res.status(400).json({ erro: 'A margem estimada deve ser um número entre 0% e 100%.' });
    }
    if (isNaN(folha) || folha < 0) {
        return res.status(400).json({ erro: 'A folha de pagamento deve ser um número maior ou igual a zero.' });
    }
    if (!activity) {
        return res.status(400).json({ erro: 'A atividade da empresa é obrigatória.' });
    }

    try {
        const simulation = taxEngine.simulateTaxes({
            annualRevenue: fat,
            margin: marg / 100,
            payroll: folha,
            activity: inferActivity(activity)
        });

        // Audit logging
        console.log(`[AUDIT] Simulation executed by user: ${req.userEmail || 'anonymous'} at ${new Date().toISOString()}`);

        return res.json(simulation);
    } catch (error) {
        return res.status(422).json({ erro: error.message });
    }
}

module.exports = {
    calcularDas,
    fiscalCalendar,
    postDiagnostico,
    gerarDasAutomatico,
    simulate
};
