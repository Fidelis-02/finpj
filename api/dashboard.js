const { getUser, mountDashboard, verifyToken } = require('./lib/auth-storage');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    const payload = verifyToken(req);
    if (!payload || !payload.email) {
        return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }

    const user = await getUser(payload.email);
    if (!user) {
        return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    const dashboard = mountDashboard(user);
    return res.status(200).json({ sucesso: true, dashboard });
};
