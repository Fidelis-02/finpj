const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('JWT_SECRET environment variable is NOT set. Protected endpoints will return 500 until configured.');
}

function extrairToken(req) {
    const header = req.headers.authorization || req.headers.Authorization;
    if (!header || typeof header !== 'string') return null;
    const parts = header.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
    return parts[1];
}

async function verificarToken(req) {
    const token = extrairToken(req);
    if (!token) return null;
    try {
        if (!JWT_SECRET) return null;
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

function verificarTokenMiddleware(req, res, next) {
    if (!JWT_SECRET) return res.status(500).json({ erro: 'Server misconfiguration: JWT_SECRET não configurado.' });
    const token = extrairToken(req);
    if (!token) return res.status(401).json({ erro: 'Token obrigatório.' });
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.userEmail = payload.email;
        next();
    } catch {
        return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }
}

module.exports = {
    extrairToken,
    verificarToken,
    verificarTokenMiddleware
};
