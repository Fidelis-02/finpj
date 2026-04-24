const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const PASSWORD_SALT_ROUNDS = Number(process.env.AUTH_PASSWORD_SALT_ROUNDS || 10);
const SESSION_TTL_MS = Number(process.env.AUTH_SESSION_TTL_MS || 7 * 24 * 60 * 60 * 1000);
const EMAIL_VERIFICATION_TTL_MS = Number(process.env.AUTH_EMAIL_VERIFICATION_TTL_MS || 24 * 60 * 60 * 1000);
const PASSWORD_RESET_TTL_MS = Number(process.env.AUTH_PASSWORD_RESET_TTL_MS || 60 * 60 * 1000);
const EMAIL_RESEND_COOLDOWN_MS = Number(process.env.AUTH_EMAIL_RESEND_COOLDOWN_MS || 60 * 1000);
const OAUTH_STATE_TTL_SECONDS = Number(process.env.AUTH_OAUTH_STATE_TTL_SECONDS || 10 * 60);

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function validatePassword(password) {
    const value = String(password || '');
    if (value.length < 8) {
        return { valid: false, code: 'PASSWORD_TOO_SHORT', message: 'Use uma senha com pelo menos 8 caracteres.' };
    }
    if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
        return { valid: false, code: 'PASSWORD_TOO_WEAK', message: 'Use ao menos uma letra e um número.' };
    }
    return { valid: true, code: 'PASSWORD_VALID', message: '' };
}

async function hashPassword(password) {
    return bcrypt.hash(String(password || ''), PASSWORD_SALT_ROUNDS);
}

async function comparePassword(password, passwordHash) {
    if (!passwordHash) return false;
    return bcrypt.compare(String(password || ''), String(passwordHash));
}

function randomOpaqueToken(bytes = 24) {
    return crypto.randomBytes(bytes).toString('hex');
}

function hashOpaqueToken(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function createScopedOpaqueToken(userId) {
    const secret = randomOpaqueToken();
    return {
        token: `${userId}.${secret}`,
        tokenHash: hashOpaqueToken(secret)
    };
}

function parseScopedOpaqueToken(token) {
    const value = String(token || '');
    const separatorIndex = value.indexOf('.');
    if (separatorIndex <= 0 || separatorIndex === value.length - 1) return null;
    const userId = value.slice(0, separatorIndex);
    const secret = value.slice(separatorIndex + 1);
    return {
        userId,
        tokenHash: hashOpaqueToken(secret)
    };
}

function getJwtSecret() {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET não configurado.');
    }
    return process.env.JWT_SECRET;
}

function issueSessionToken({ userId, sessionId, email, provider = 'password' }) {
    const expiresInSeconds = Math.max(60, Math.floor(SESSION_TTL_MS / 1000));
    const token = jwt.sign({
        sub: userId,
        sid: sessionId,
        email: normalizeEmail(email),
        provider
    }, getJwtSecret(), { expiresIn: expiresInSeconds });

    return {
        token,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
    };
}

function verifySessionToken(token) {
    return jwt.verify(String(token || ''), getJwtSecret());
}

function signOAuthState(payload = {}) {
    return jwt.sign({
        type: 'oauth-state',
        provider: payload.provider,
        mode: payload.mode || 'login',
        returnTo: payload.returnTo || '/dashboard'
    }, getJwtSecret(), { expiresIn: OAUTH_STATE_TTL_SECONDS });
}

function verifyOAuthState(state) {
    const payload = jwt.verify(String(state || ''), getJwtSecret());
    if (payload?.type !== 'oauth-state') {
        throw new Error('Estado OAuth inválido.');
    }
    return payload;
}

function isFutureDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}

function isCooldownActive(value) {
    if (!value) return false;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return date.getTime() + EMAIL_RESEND_COOLDOWN_MS > Date.now();
}

function publicAuthUser(user = {}, onboarding = null) {
    return {
        id: user.id,
        email: normalizeEmail(user.email),
        emailVerified: Boolean(user.emailVerifiedAt),
        name: user.profile?.name || '',
        avatarUrl: user.profile?.avatarUrl || '',
        usageType: user.profile?.usageType || '',
        plan: user.plan || 'freemium',
        templateKey: user.templateKey || '',
        onboardingCompleted: Boolean(onboarding?.completedAt),
        createdAt: user.createdAt || null
    };
}

module.exports = {
    PASSWORD_SALT_ROUNDS,
    SESSION_TTL_MS,
    EMAIL_VERIFICATION_TTL_MS,
    PASSWORD_RESET_TTL_MS,
    EMAIL_RESEND_COOLDOWN_MS,
    normalizeEmail,
    validateEmail,
    validatePassword,
    hashPassword,
    comparePassword,
    randomOpaqueToken,
    hashOpaqueToken,
    createScopedOpaqueToken,
    parseScopedOpaqueToken,
    issueSessionToken,
    verifySessionToken,
    signOAuthState,
    verifyOAuthState,
    isFutureDate,
    isCooldownActive,
    publicAuthUser
};
