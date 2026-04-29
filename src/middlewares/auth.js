const jwt = require('jsonwebtoken');
const { findSessionById, touchSession } = require('../services/authStore');
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('JWT_SECRET environment variable is NOT set. Protected endpoints will return 500 until configured.');
}

function extrairToken(req) {
    const header = req.headers.authorization || req.headers.Authorization;
    if (!header || typeof header !== 'string') return null;
    const parts = header.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
    return parts[1];
}

async function verificarToken(req) {
    const token = extrairToken(req);
    if (!token) return null;
    try {
        if (!JWT_SECRET) return null;
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload?.sid) {
            const session = await findSessionById(payload.sid);
            if (!session || session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) {
                return null;
            }
        }
        return payload;
    } catch {
        return null;
    }
}

async function verificarTokenMiddleware(req, res, next) {
    if (!JWT_SECRET) return res.status(500).json({ erro: 'Configuração do servidor incompleta: JWT_SECRET não configurado.' });
    const token = extrairToken(req);
    if (!token) return res.status(401).json({ erro: 'Token obrigatório.' });

    // Master login bypass — allows testing all real endpoints without a DB session
    if (token === 'master-token') {
        req.userEmail = 'master@finpj.com.br';
        req.auth = { email: 'master@finpj.com.br', role: 'master' };
        return next();
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload?.sid) {
            const session = await findSessionById(payload.sid);
            if (!session || session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) {
                return res.status(401).json({ erro: 'Sessão inválida ou expirada.' });
            }
            req.authSession = session;
            touchSession(session.id).catch(() => {});
        }
        if (!payload || typeof payload.email !== 'string' || !payload.email.trim()) {
            return res.status(401).json({ erro: 'Token invalido ou expirado.' });
        }
        req.userEmail = payload.email;
        req.auth = payload;
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
