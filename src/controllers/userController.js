const { obterUsuario, salvarUsuario } = require('../services/database');

async function getProfile(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    const { verificationCodeHash, codeExpiresAt, passwordHash, ...safe } = usuario;
    res.json({ sucesso: true, profile: safe });
}

async function updateProfile(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    const { nome, fantasia, telefone, nomeEmpresa, cnpj, regime, setor, faturamento, margem } = req.body;
    if (nome) usuario.nome = String(nome).trim();
    if (fantasia) usuario.fantasia = String(fantasia).trim();
    if (telefone) usuario.telefone = String(telefone).trim();
    if (nomeEmpresa) usuario.nomeEmpresa = String(nomeEmpresa).trim();
    if (cnpj) usuario.cnpj = cnpj.replace(/\D/g, '');
    if (regime) usuario.regime = regime;
    if (setor) usuario.setor = setor;
    if (faturamento) usuario.faturamento = Number(faturamento) || usuario.faturamento;
    if (margem) usuario.margem = Number(margem) || usuario.margem;
    await salvarUsuario(usuario);
    res.json({ sucesso: true });
}

async function getNotifications(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    const notifs = [];
    const banks = usuario.connectedBanks || [];
    if (banks.length === 0) notifs.push({ id: 'no-bank', tipo: 'info', msg: 'Conecte um banco via Open Finance para importar transações.', data: new Date().toISOString() });
    banks.forEach(b => {
        const lastSync = new Date(b.lastSync);
        const diffDays = Math.floor((Date.now() - lastSync) / 86400000);
        if (diffDays > 3) notifs.push({ id: `sync-${b.bankId}`, tipo: 'warning', msg: `${b.bankName}: última sincronização há ${diffDays} dias.`, data: b.lastSync });
        const saidas = (b.transactions || []).filter(t => t.tipo === 'saida');
        const maxSaida = saidas.reduce((m, t) => Math.max(m, Math.abs(t.valor)), 0);
        if (maxSaida > 10000) notifs.push({ id: `alert-${b.bankId}`, tipo: 'danger', msg: `${b.bankName}: saída de R$ ${maxSaida.toLocaleString('pt-BR')} detectada.`, data: new Date().toISOString() });
    });
    const hoje = new Date();
    const dia = hoje.getDate();
    if (dia >= 15 && dia <= 20) notifs.push({ id: 'das', tipo: 'warning', msg: 'Prazo do DAS/Simples Nacional se aproxima (dia 20).', data: hoje.toISOString() });
    if (dia >= 20 && dia <= 25) notifs.push({ id: 'darf', tipo: 'warning', msg: 'Prazo de DARF/PIS/COFINS se aproxima (dia 25).', data: hoje.toISOString() });
    res.json({ sucesso: true, notifications: notifs });
}

async function readNotifications(req, res) {
    res.json({ sucesso: true });
}

module.exports = {
    getProfile,
    updateProfile,
    getNotifications,
    readNotifications
};
