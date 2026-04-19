const jwt = require('jsonwebtoken');
const { compareCode, formatEmail, getUser, saveUser, validateEmail, mountDashboard, JWT_SECRET } = require('../lib/auth-storage');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    const { email, code } = req.body || {};
    if (!validateEmail(email) || !code || String(code).trim().length === 0) {
        return res.status(400).json({ erro: 'Email e código são obrigatórios' });
    }

    const normalizedEmail = formatEmail(email);
    const user = await getUser(normalizedEmail);
    if (!user || !user.verificationCodeHash) {
        return res.status(400).json({ erro: 'Código de verificação incorreto ou expirado.' });
    }

    if (Date.now() > user.codeExpiresAt) {
        return res.status(400).json({ erro: 'O código expirou. Solicite um novo código.' });
    }

    const isValid = await compareCode(code, user.verificationCodeHash);
    if (!isValid) {
        return res.status(400).json({ erro: 'Código de verificação incorreto.' });
    }

    user.lastLogin = new Date().toISOString();
    delete user.verificationCodeHash;
    delete user.codeExpiresAt;
    delete user.lastCodeSentAt;

    await saveUser(user);

    const token = jwt.sign({ email: normalizedEmail }, JWT_SECRET, { expiresIn: '7d' });
    const dashboard = mountDashboard(user);

    return res.status(200).json({ sucesso: true, token, dashboard });
};
