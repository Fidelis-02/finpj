const { getPilotMetrics } = require('../services/pilotTelemetry');

async function getMetrics(req, res) {
    try {
        const metrics = await getPilotMetrics({
            email: req.userEmail,
            companyId: req.query?.companyId
        });
        return res.json({ sucesso: true, metricas: metrics });
    } catch (error) {
        console.error('Erro ao obter métricas do piloto:', error);
        return res.status(500).json({ erro: 'Não foi possível carregar as métricas do piloto.' });
    }
}

module.exports = { getMetrics };
