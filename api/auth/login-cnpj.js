const jwt = require('jsonwebtoken');
const { getUserByCnpj, saveUser, compareCode, mountDashboard, JWT_SECRET } = require('../lib/auth-storage');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ erro: 'Método não permitido.' });
    }

    const { cnpj, password } = req.body || {};
    if (!cnpj || !password) {
        return res.status(400).json({ erro: 'CNPJ e senha são obrigatórios.' });
    }

    const user = await getUserByCnpj(cnpj);
    if (!user || !user.passwordHash) {
        return res.status(400).json({ erro: 'CNPJ ou senha incorretos.' });
    }

    const isValid = await compareCode(password, user.passwordHash);
    if (!isValid) {
        return res.status(400).json({ erro: 'CNPJ ou senha incorretos.' });
    }

    user.lastLogin = new Date().toISOString();
    await saveUser(user);

    const token = jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    const dashboard = mountDashboard(user);

    return res.status(200).json({ sucesso: true, token, email: user.email, dashboard });
};
