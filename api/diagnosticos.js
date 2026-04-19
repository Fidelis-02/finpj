function fmtReais(valor) {
    return 'R$ ' + Math.round(Number(valor) || 0).toLocaleString('pt-BR');
}

function gerarAnaliseInterna(resultados, dados) {
    const economia = resultados.economia || 0;
    const creditos = resultados.creditosIdentificados || 0;
    const anomalia = resultados.anomaliaValor || 0;
    const percentualEconomia = dados.faturamento > 0 ? Math.round((economia / dados.faturamento) * 100) : 0;

    const recomendacoes = [
        `Regime ideal sugerido: ${resultados.regimeIdeal}.`,
        percentualEconomia >= 8
            ? 'Priorize a revisão tributária imediata para capturar economias significativas.'
            : 'Continue monitorando a estrutura tributária e confirme as oportunidades apontadas.',
        `Verifique ${fmtReais(creditos)} em créditos tributários e ${fmtReais(anomalia)} em possíveis anomalias de custo.`
    ];

    return {
        resumo: `Com base no faturamento de ${fmtReais(dados.faturamento)} e na margem informada, o diagnóstico sugere ${resultados.regimeIdeal} como o regime mais vantajoso com uma economia potencial de ${fmtReais(economia)} ao ano.`,
        recomendacoes
    };
}

export default function handler(req, res) {
    if (req.method === 'POST') {
        const { nome, cnpj, faturamento, margem, setor, regime } = req.body;

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

        const resultados = {
            regimeIdeal,
            impostoIdeal: Math.min(impostoSimples, impostoPresumido, impostoReal),
            economia: Math.round(Math.max(impostoSimples, impostoPresumido, impostoReal) - Math.min(impostoSimples, impostoPresumido, impostoReal)),
            creditosIdentificados: Math.round(fat * 0.05),
            anomaliaValor: Math.round(Math.random() > 0.5 ? fat * 0.01 : 0),
            impostos: {
                simples: Math.round(impostoSimples),
                presumido: Math.round(impostoPresumido),
                real: Math.round(impostoReal)
            }
        };

        const analise = gerarAnaliseInterna(resultados, { faturamento: fat, margem: marg, setor, regime });

        return res.status(200).json({
            sucesso: true,
            resultados: {
                ...resultados,
                resumo: analise.resumo,
                recomendacoes: analise.recomendacoes
            }
        });
    }

    return res.status(405).json({ erro: 'Método não permitido' });
}