const { salvarDiagnostico, obterUsuario } = require('../services/database');
const { gerarAnaliseFinanceira } = require('../services/aiService');
const { fetchNotasFiscais, calcularDasAutomatico } = require('../services/nfeService');

async function calcularDas(req, res) {
    const { faturamento, regime, atividade } = req.body;
    const fat = Number(faturamento) || 0;
    if (fat <= 0) return res.status(400).json({ erro: 'Informe o faturamento.' });
    let aliq, valor, guia, vencimento;
    const hoje = new Date();
    const proxMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 20);
    vencimento = proxMes.toISOString().slice(0, 10);
    if (regime === 'simples') {
        if (fat <= 180000) aliq = 0.06; else if (fat <= 360000) aliq = 0.112; else if (fat <= 720000) aliq = 0.135;
        else if (fat <= 1800000) aliq = 0.16; else if (fat <= 3600000) aliq = 0.21; else aliq = 0.33;
        if (atividade === 'comercio') aliq *= 0.85;
        valor = Math.round((fat / 12) * aliq);
        guia = 'DAS';
    } else if (regime === 'presumido') {
        const base = atividade === 'comercio' ? fat * 0.08 : fat * 0.32;
        valor = Math.round((base * 0.15 + Math.max(0, base - 240000) * 0.10 + base * 0.09 + fat * 0.0925) / 12);
        aliq = valor / (fat / 12);
        guia = 'DARF';
    } else {
        valor = Math.round((fat * 0.12 * 0.34 + fat * 0.0925) / 12);
        aliq = valor / (fat / 12);
        guia = 'DARF';
    }
    res.json({ sucesso: true, guia, valor, aliquotaEfetiva: (aliq * 100).toFixed(2), vencimento, faturamentoMensal: Math.round(fat / 12) });
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
    const { nome, cnpj, setor, regime, faturamento, margem } = req.body;

    if (!nome || !cnpj) {
        return res.status(400).json({ erro: 'Nome e CNPJ são obrigatórios' });
    }

    const fat = parseInt(faturamento) || 4800000;
    const marg = parseFloat(margem) || 0.12;

    const impostoSimples = fat * 0.11;
    const impostoPresumido = fat * 0.15;
    const impostoReal = (fat * marg) * 0.24;

    const regimeIdeal =
        impostoSimples < impostoPresumido && impostoSimples < impostoReal
            ? 'Simples Nacional'
            : impostoPresumido < impostoReal
            ? 'Lucro Presumido'
            : 'Lucro Real';

    const impostoIdeal = Math.min(impostoSimples, impostoPresumido, impostoReal);
    const economia = Math.max(impostoSimples, impostoPresumido, impostoReal) - impostoIdeal;

    const creditosIdentificados = fat * 0.05;
    const anomaliaValor = Math.random() > 0.5 ? fat * 0.01 : 0;

    const diagnostico = {
        id: Date.now(),
        nome,
        cnpj,
        ownerEmail: req.userEmail || null,
        setor,
        regime,
        faturamento: fat,
        margem: marg,
        data: new Date().toISOString(),
        resultados: {
            regimeIdeal,
            impostoIdeal: Math.round(impostoIdeal),
            economia: Math.round(economia),
            creditosIdentificados: Math.round(creditosIdentificados),
            anomaliaValor: Math.round(anomaliaValor),
            impostos: {
                simples: Math.round(impostoSimples),
                presumido: Math.round(impostoPresumido),
                real: Math.round(impostoReal)
            }
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
