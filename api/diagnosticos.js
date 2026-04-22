const taxEngine = require('../src/tax');
const taxUtils = require('../src/tax/utils');

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
        resumo: `Com base no faturamento de ${fmtReais(dados.faturamento)} e na margem informada, o diagnóstico sugere ${resultados.regimeIdeal} como o regime mais vantajoso, com economia potencial de ${fmtReais(economia)} ao ano.`,
        recomendacoes
    };
}

module.exports = function handler(req, res) {
    if (req.method === 'POST') {
        const { faturamento, margem, setor, regime } = req.body;

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
            simulation = taxEngine.simulateTaxes({
                annualRevenue: fat,
                margin: marg,
                activity: taxUtils.normalizeActivity(setor || 'comercio')
            });
        } catch (error) {
            return res.status(400).json({ erro: error.message });
        }

        const best = simulation.bestRegime;
        const impostos = simulation.regimes.reduce((acc, item) => {
            acc[item.key] = item.annualTax == null ? null : Math.round(item.annualTax);
            return acc;
        }, {});

        const resultados = {
            regimeIdeal: best.name,
            impostoIdeal: Math.round(best.annualTax),
            economia: Math.round(simulation.savingsComparedToWorst?.annual || 0),
            creditosIdentificados: 0,
            anomaliaValor: 0,
            impostos,
            regimes: simulation.regimes,
            premissas: simulation.assumptions
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

    return res.status(405).json({ erro: 'Método não permitido.' });
};
