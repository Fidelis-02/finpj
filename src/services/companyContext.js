const { resolveCompany } = require('./dashboardService');

function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

function normalizeCompanyId(value) {
    return String(value || '').trim().toLowerCase();
}

function parseNumericLike(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const normalized = String(value)
        .replace(/[^\d,.-]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : null;
}

function parseAnnualRevenueInput(payload = {}) {
    const monthlyRevenue = parseNumericLike(
        payload.monthlyRevenue
        ?? payload.faturamentoMensal
        ?? payload.monthly_revenue
    );
    if (Number.isFinite(monthlyRevenue) && monthlyRevenue > 0) {
        return Math.round(monthlyRevenue * 12);
    }

    const annualRevenue = parseNumericLike(
        payload.faturamento
        ?? payload.faturamentoAnual
        ?? payload.annualRevenue
        ?? payload.annual_revenue
    );
    if (Number.isFinite(annualRevenue) && annualRevenue > 0) {
        return Math.round(annualRevenue);
    }

    return null;
}

function parseMarginInput(payload = {}) {
    const rawMargin = parseNumericLike(
        payload.margem
        ?? payload.margin
        ?? payload.margemEstimada
        ?? payload.estimatedMargin
    );
    if (!Number.isFinite(rawMargin) || rawMargin < 0) return null;
    return rawMargin > 1 ? rawMargin / 100 : rawMargin;
}

function getScopedCompanyRecord(usuario = {}, companyId) {
    const snapshot = resolveCompany(usuario, companyId);
    const companies = Array.isArray(usuario.empresas) ? usuario.empresas : [];
    const index = companies.findIndex((company) => (
        normalizeCompanyId(company.id) === snapshot.id
        || onlyDigits(company.cnpj) === snapshot.cnpj
    ));

    if (index === -1) {
        return {
            snapshot,
            target: usuario,
            isPrimary: true,
            index: -1
        };
    }

    return {
        snapshot,
        target: companies[index],
        isPrimary: false,
        index
    };
}

function persistScopedCompanyRecord(usuario = {}, scoped = {}, nextTarget = {}) {
    if (scoped.isPrimary || scoped.index === -1) {
        Object.assign(usuario, nextTarget);
        return usuario;
    }

    usuario.empresas = Array.isArray(usuario.empresas) ? usuario.empresas : [];
    usuario.empresas[scoped.index] = nextTarget;
    return usuario.empresas[scoped.index];
}

function ensureCompanyBanks(record = {}) {
    if (!Array.isArray(record.connectedBanks)) {
        record.connectedBanks = [];
    }
    return record.connectedBanks;
}

function recordMatchesCompany(record = {}, scoped = {}, options = {}) {
    const companyId = normalizeCompanyId(scoped?.snapshot?.id);
    const companyCnpj = onlyDigits(scoped?.snapshot?.cnpj);
    const recordCompanyId = normalizeCompanyId(record.companyId || record.company?.id);
    const recordCompanyCnpj = onlyDigits(record.companyCnpj || record.cnpj);

    if (recordCompanyId) return recordCompanyId === companyId;
    if (recordCompanyCnpj && companyCnpj) return recordCompanyCnpj === companyCnpj;
    return Boolean(options.includeUnscoped);
}

function filterRecordsByCompany(records = [], scoped = {}, options = {}) {
    const includeUnscoped = options.includeUnscoped ?? Boolean(scoped?.isPrimary);
    return records.filter((record) => recordMatchesCompany(record, scoped, { includeUnscoped }));
}

function attachCompanyScope(record = {}, scoped = {}) {
    const companyId = scoped?.snapshot?.id || null;
    const companyCnpj = scoped?.snapshot?.cnpj || null;
    return {
        ...record,
        ...(companyId ? { companyId } : {}),
        ...(companyCnpj ? { companyCnpj } : {})
    };
}

module.exports = {
    onlyDigits,
    normalizeCompanyId,
    parseAnnualRevenueInput,
    parseMarginInput,
    getScopedCompanyRecord,
    persistScopedCompanyRecord,
    ensureCompanyBanks,
    recordMatchesCompany,
    filterRecordsByCompany,
    attachCompanyScope
};
