const { salvarDiagnostico, obterUsuario } = require('../services/database');
const { gerarAnaliseFinanceira } = require('../services/aiService');
const { fetchNotasFiscais, calcularDasAutomatico } = require('../services/nfeService');
const taxUtils = require('../tax/utils');
const { getFiscalSimulation } = require('../services/fiscalCache');

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
    res.json({
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
    const anoSelecionado = parseInt(req.query.ano) || hoje.getFullYear();
    const eventos = [];
    const templateEventos = [
        { dia: 7, titulo: 'FGTS', desc: 'Recolhimento do FGTS', tipo: 'imposto' },
        { dia: 10, titulo: 'GPS/INSS', desc: 'Guia da Previdência Social', tipo: 'imposto' },
        { dia: 15, titulo: 'ISS', desc: 'Imposto Sobre Serviços (municipal)', tipo: 'imposto' },
        { dia: 20, titulo: 'DAS', desc: 'Documento de Arrecadação do Simples Nacional', tipo: 'imposto' },
        { dia: 20, titulo: 'IRRF', desc: 'Imposto de Renda Retido na Fonte', tipo: 'imposto' },
        { dia: 25, titulo: 'PIS/COFINS', desc: 'Contribuição PIS e COFINS', tipo: 'imposto' },
        { dia: 25, titulo: 'ICMS', desc: 'Imposto sobre Circulação de Mercadorias', tipo: 'imposto' },
        { dia: 28, titulo: 'CSLL', desc: 'Contribuição Social sobre o Lucro Líquido', tipo: 'imposto' },
        { dia: 1, titulo: 'Folha', desc: 'Processamento da folha de pagamento', tipo: 'rh' },
        { dia: 5, titulo: 'Pro-labore', desc: 'Pagamento de pro-labore aos sócios', tipo: 'rh' },
        { dia: 30, titulo: 'Balanço', desc: 'Fechamento contábil mensal', tipo: 'contabil' },
    ];
    for (let m = 0; m < 12; m++) {
        templateEventos.forEach(e => {
            const dataEvento = new Date(anoSelecionado, m, e.dia);
            eventos.push({
                ...e,
                mes: m,
                data: dataEvento.toISOString().slice(0, 10),
                passado: dataEvento < hoje
            });
        });
    }
    res.json({ sucesso: true, eventos, ano: anoSelecionado });
}

async function postDiagnostico(req, res) {
    const { nome, cnpj, setor, regime, faturamento, margem, ncm } = req.body;

    if (!nome || !cnpj) {
        return res.status(400).json({ erro: 'Nome e CNPJ são obrigatórios' });
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
            activity: inferActivity(setor)
        }).simulation;
    } catch (error) {
        return res.status(400).json({ erro: error.message });
    }

    const best = simulation.bestRegime;
    const economia = simulation.savingsComparedToWorst?.annual || 0;
    
    // Cálculo PIS/COFINS Monofásico
    let creditosIdentificados = 0;
    if (ncm && ncm.trim() !== '') {
        const parcelaMonofasica = fat * 0.3; // 30% presumido monofásico
        creditosIdentificados = parcelaMonofasica * 0.0925; // 9,25% PIS/COFINS
    }

    const impostos = simulation.regimes.reduce((acc, item) => {
        acc[item.key] = item.annualTax == null ? null : Math.round(item.annualTax);
        return acc;
    }, {});

    const diagnostico = {
        id: `diag_${Date.now()}`,
        nome,
        cnpj,
        ownerEmail: req.userEmail || null,
        setor,
        regime,
        ncm: ncm || '',
        faturamento: fat,
        margem: marg,
        data: new Date().toISOString(),
        resultados: {
            regimeIdeal: best.name,
            impostoIdeal: Math.round(best.annualTax),
            economia: Math.round(economia),
            creditosIdentificados: Math.round(creditosIdentificados),
            anomaliaValor: 0,
            impostos,
            regimes: simulation.regimes,
            premissas: simulation.assumptions
        }
    };

    const analise = await gerarAnaliseFinanceira(diagnostico);
    diagnostico.resultados = {
        ...diagnostico.resultados,
        resumo: analise.resumo,
        recomendacoes: analise.recomendacoes
    };

    await salvarDiagnostico(diagnostico);

    res.json({ sucesso: true, id: diagnostico.id, resultados: diagnostico.resultados });
}

async function gerarDasAutomatico(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario || !usuario.cnpj) {
        return res.status(400).json({ erro: 'Usuário sem CNPJ cadastrado para buscar notas fiscais.' });
    }

    // 1. Busca notas fiscais
    const dadosNfe = await fetchNotasFiscais(usuario.cnpj);
    
    // 2. Calcula o DAS
    const das = calcularDasAutomatico(dadosNfe.resumo.faturamento);
    
    // 3. Salva no usuário (mock)
    if (!usuario.impostosEmitidos) usuario.impostosEmitidos = [];
    usuario.impostosEmitidos.push({
        ...das,
        faturamentoBase: dadosNfe.resumo.faturamento,
        emitidoEm: new Date().toISOString()
    });
    await salvarUsuario(usuario);

    res.json({
        sucesso: true,
        nfe: dadosNfe,
        das: das
    });
}

module.exports = {
    calcularDas,
    fiscalCalendar,
    postDiagnostico,
    gerarDasAutomatico
};
