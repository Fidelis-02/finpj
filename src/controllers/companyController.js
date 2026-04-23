const { obterUsuario, salvarUsuario } = require('../services/database');
const { clearDashboardCache, getCompanies } = require('../services/dashboardService');
const {
    onlyDigits,
    normalizeCompanyId,
    parseAnnualRevenueInput,
    parseMarginInput
} = require('../services/companyContext');

async function getCompaniesHandler(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado.' });
    return res.json({ sucesso: true, companies: getCompanies(usuario) });
}

async function createCompanyHandler(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado.' });

    const { cnpj, nome, fantasia, regime, setor } = req.body || {};
    const cnpjOnly = onlyDigits(cnpj || '');
    if (cnpjOnly.length !== 14) {
        return res.status(400).json({ erro: 'CNPJ invalido. Informe 14 digitos.' });
    }

    const existingCompanies = getCompanies(usuario);
    const generatedId = normalizeCompanyId(cnpjOnly || nome || `${Date.now()}`);
    const duplicated = existingCompanies.some((company) => (
        onlyDigits(company.cnpj) === cnpjOnly || normalizeCompanyId(company.id) === generatedId
    ));
    if (duplicated) {
        return res.status(400).json({ erro: 'Empresa ja cadastrada para este usuario.' });
    }

    const annualRevenue = parseAnnualRevenueInput(req.body || {});
    const margin = parseMarginInput(req.body || {});
    const now = new Date().toISOString();

    usuario.empresas = Array.isArray(usuario.empresas) ? usuario.empresas : [];
    const company = {
        id: generatedId,
        cnpj: cnpjOnly,
        nome: String(nome || fantasia || '').trim(),
        fantasia: String(fantasia || nome || '').trim(),
        regime: regime || '',
        setor: setor || '',
        ...(annualRevenue ? { faturamento: annualRevenue } : {}),
        ...(margin !== null ? { margem: margin } : {}),
        createdAt: now,
        updatedAt: now,
        connectedBanks: []
    };

    usuario.empresas.push(company);
    usuario.updatedAt = now;
    await salvarUsuario(usuario);
    clearDashboardCache();

    return res.json({
        sucesso: true,
        company,
        companies: getCompanies(usuario)
    });
}

async function updateCompanyHandler(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado.' });

    const companyId = req.params.companyId;
    if (!companyId) return res.status(400).json({ erro: 'companyId e obrigatorio.' });

    usuario.empresas = Array.isArray(usuario.empresas) ? usuario.empresas : [];
    const normalizedId = normalizeCompanyId(companyId);
    const index = usuario.empresas.findIndex((company) => (
        normalizeCompanyId(company.id) === normalizedId
        || onlyDigits(company.cnpj) === onlyDigits(companyId)
    ));
    if (index === -1) return res.status(404).json({ erro: 'Empresa nao encontrada.' });

    const target = { ...usuario.empresas[index] };
    const { nome, fantasia, regime, setor } = req.body || {};
    const annualRevenue = parseAnnualRevenueInput(req.body || {});
    const margin = parseMarginInput(req.body || {});
    const now = new Date().toISOString();

    if (nome !== undefined) target.nome = String(nome || '').trim();
    if (fantasia !== undefined) target.fantasia = String(fantasia || '').trim();
    if (regime !== undefined) target.regime = regime || '';
    if (setor !== undefined) target.setor = setor || '';
    if (annualRevenue !== null) target.faturamento = annualRevenue;
    if (margin !== null) target.margem = margin;
    target.updatedAt = now;

    usuario.empresas[index] = target;
    usuario.updatedAt = now;
    await salvarUsuario(usuario);
    clearDashboardCache();

    return res.json({
        sucesso: true,
        company: target,
        companies: getCompanies(usuario)
    });
}

module.exports = {
    getCompanies: getCompaniesHandler,
    createCompany: createCompanyHandler,
    updateCompany: updateCompanyHandler
};
