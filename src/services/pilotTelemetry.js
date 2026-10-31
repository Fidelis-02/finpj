const crypto = require('crypto');
const { salvarEventoPiloto, obterMetricasPiloto } = require('./database');

const EVENT_TYPES = new Set([
    'document_upload_started',
    'document_analysis_completed',
    'document_analysis_rejected',
    'document_analysis_failed'
]);

function hashOwner(email) {
    return crypto.createHash('sha256')
        .update(String(email || '').trim().toLowerCase())
        .digest('hex');
}

async function recordPilotEvent({ email, companyId, type, metadata = {} }) {
    if (!EVENT_TYPES.has(type)) {
        throw new Error(`Evento de piloto não suportado: ${type}`);
    }

    return salvarEventoPiloto({
        ownerHash: hashOwner(email),
        companyId: companyId || null,
        type,
        metadata
    });
}

async function getPilotMetrics({ email, companyId }) {
    return obterMetricasPiloto(hashOwner(email), companyId || null);
}

module.exports = {
    recordPilotEvent,
    getPilotMetrics
};
