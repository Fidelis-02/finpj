const { obterUsuario, salvarUsuario } = require('../services/database');
const { clearDashboardCache } = require('../services/dashboardService');
const {
    onlyDigits,
    parseAnnualRevenueInput,
    parseMarginInput,
    getScopedCompanyRecord,
    persistScopedCompanyRecord
} = require('../services/companyContext');

function buildProfileResponse(usuario = {}, scoped = {}) {
    const source = scoped?.target || usuario;
    const snapshot = scoped?.snapshot || {};

    return {
        companyId: snapshot.id || null,
        isPrimary: Boolean(scoped?.isPrimary),
        nome: source.nome || snapshot.nome || '',
        fantasia: source.fantasia || snapshot.fantasia || '',
        telefone: scoped?.isPrimary ? (usuario.telefone || '') : (source.telefone || ''),
        cnpj: source.cnpj || snapshot.cnpj || '',
        regime: source.regime || snapshot.regime || '',
        setor: source.setor || snapshot.setor || '',
        faturamento: source.faturamento ?? snapshot.faturamento ?? '',
        margem: source.margem ?? snapshot.margem ?? ''
    };
}

async function getProfile(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado.' });

    const scoped = getScopedCompanyRecord(usuario, req.query?.companyId);
    return res.json({ sucesso: true, profile: buildProfileResponse(usuario, scoped) });
}

async function updateProfile(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado.' });

    const scoped = getScopedCompanyRecord(usuario, req.body?.companyId || req.query?.companyId);
    const target = { ...(scoped.target || {}) };
    const {
        nome,
        fantasia,
        telefone,
        cnpj,
        regime,
        setor
    } = req.body || {};
    const annualRevenue = parseAnnualRevenueInput(req.body || {});
    const margin = parseMarginInput(req.body || {});
    const now = new Date().toISOString();

    if (nome !== undefined) target.nome = String(nome || '').trim();
    if (fantasia !== undefined) target.fantasia = String(fantasia || '').trim();
    if (regime !== undefined) target.regime = regime || '';
    if (setor !== undefined) target.setor = String(setor || '').trim();
    if (annualRevenue !== null) target.faturamento = annualRevenue;
    if (margin !== null) target.margem = margin;

    if (scoped.isPrimary) {
        if (telefone !== undefined) target.telefone = String(telefone || '').trim();
        if (cnpj !== undefined) target.cnpj = onlyDigits(cnpj || '');
    } else if (cnpj !== undefined) {
        target.cnpj = onlyDigits(cnpj || target.cnpj || '');
    }

    target.updatedAt = now;
    persistScopedCompanyRecord(usuario, scoped, target);
    usuario.updatedAt = now;

    await salvarUsuario(usuario);
    clearDashboardCache();

    const nextScoped = getScopedCompanyRecord(usuario, scoped.snapshot?.id);
    return res.json({ sucesso: true, profile: buildProfileResponse(usuario, nextScoped) });
}

async function getNotifications(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado.' });
    const notifs = [];
    const banks = usuario.connectedBanks || [];
    if (banks.length === 0) notifs.push({ id: 'no-bank', tipo: 'info', msg: 'Conecte um banco via Open Finance para importar transacoes.', data: new Date().toISOString() });
    banks.forEach((bank) => {
        const lastSync = new Date(bank.lastSync);
        const diffDays = Math.floor((Date.now() - lastSync) / 86400000);
        if (diffDays > 3) notifs.push({ id: `sync-${bank.bankId}`, tipo: 'warning', msg: `${bank.bankName}: ultima sincronizacao ha ${diffDays} dias.`, data: bank.lastSync });
        const saidas = (bank.transactions || []).filter((transaction) => transaction.tipo === 'saida');
        const maxSaida = saidas.reduce((memo, transaction) => Math.max(memo, Math.abs(transaction.valor)), 0);
        if (maxSaida > 10000) notifs.push({ id: `alert-${bank.bankId}`, tipo: 'danger', msg: `${bank.bankName}: saida de R$ ${maxSaida.toLocaleString('pt-BR')} detectada.`, data: new Date().toISOString() });
    });
    const hoje = new Date();
    const dia = hoje.getDate();
    if (dia >= 15 && dia <= 20) notifs.push({ id: 'das', tipo: 'warning', msg: 'Prazo do DAS/Simples Nacional se aproxima (dia 20).', data: hoje.toISOString() });
    if (dia >= 20 && dia <= 25) notifs.push({ id: 'darf', tipo: 'warning', msg: 'Prazo de DARF/PIS/COFINS se aproxima (dia 25).', data: hoje.toISOString() });
    return res.json({ sucesso: true, notifications: notifs });
}

async function readNotifications(req, res) {
    return res.json({ sucesso: true });
}

module.exports = {
    getProfile,
    updateProfile,
    getNotifications,
    readNotifications
};
