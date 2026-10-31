// Importação do módulo UMD - carregar via index.js para garantir compatibilidade
const taxEngine = require('../tax/index');
const simplesNacional = taxEngine.regimes.simplesNacional;

async function fetchNotasFiscais(cnpj) {
    const baseUrl = process.env.FOCUS_NFE_URL;
    const apiKey = process.env.FOCUS_NFE_KEY;
    if (!baseUrl || !apiKey) {
        throw new Error('Integração fiscal não configurada.');
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v2/nfe/recebidas?cnpj=${encodeURIComponent(cnpj)}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}` },
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
        throw new Error(`Falha na consulta de notas fiscais (${response.status}).`);
    }
    const payload = await response.json();
    const notas = Array.isArray(payload) ? payload : payload.notas || [];
    return {
        sucesso: true,
        notas,
        resumo: {
            periodo: new Date().toISOString().slice(0, 7),
            totalNotas: notas.length,
            faturamento: notas.reduce((total, nota) => total + Number(nota.valor || 0), 0)
        }
    };
}

function calcularDasAutomatico(faturamentoPeriodo, anexoI = true) {
    // Cálculo simplificado do Simples Nacional
    // No mundo real, precisaríamos do faturamento dos últimos 12 meses (RBT12)
    // Aqui usamos o faturamento do mês projetado para o ano
    const rbt12 = faturamentoPeriodo * 12;
    const result = simplesNacional.calculate({
        annualRevenue: rbt12,
        margin: 0,
        activity: 'comercio',
        calendarYear: new Date().getFullYear()
    });
    if (result.eligible === false) {
        throw new Error(result.reason || 'Faturamento fora do Simples Nacional.');
    }
    
    // Tabela Anexo I (Comércio)
    const valorDas = Math.round((result.annualTax / 12) * 100) / 100;
    const hoje = new Date();
    const vencimento = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 20).toISOString().slice(0, 10);
    
    return {
        valor: valorDas,
        aliquotaEfetiva: (result.effectiveRate * 100).toFixed(2),
        vencimento: vencimento,
        competencia: hoje.toISOString().slice(0, 7),
        linhaDigitavel: null
    };
}

module.exports = {
    fetchNotasFiscais,
    calcularDasAutomatico
};
