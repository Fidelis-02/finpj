const crypto = require('crypto');

const { conectarDB, obterUsuario, salvarUsuario } = require('./database');
const { generateBankReports } = require('./dashboardService');
const { normalizeEmail } = require('./authTokens');
const {
    createInitialOnboardingState,
    mergeOnboardingState,
    normalizeStep
} = require('./onboardingService');

function nowIso() {
    return new Date().toISOString();
}

function sanitizeOnboardingState(state) {
    if (!state) return null;
    const { _id, ...safeState } = state;
    return safeState;
}

function baseUserRecord(data = {}) {
    const now = nowIso();
    return {
        id: data.id || crypto.randomUUID(),
        email: normalizeEmail(data.email),
        passwordHash: data.passwordHash || '',
        emailVerifiedAt: data.emailVerifiedAt || null,
        providers: data.providers || {},
        profile: {
            name: data.profile?.name || '',
            avatarUrl: data.profile?.avatarUrl || '',
            usageType: data.profile?.usageType || ''
        },
        plan: data.plan || 'freemium',
        templateKey: data.templateKey || '',
        status: data.status || 'active',
        emailVerification: data.emailVerification || null,
        passwordReset: data.passwordReset || null,
        lastLoginAt: data.lastLoginAt || null,
        createdAt: data.createdAt || now,
        updatedAt: data.updatedAt || now
    };
}

function mergeUser(existing = {}, patch = {}) {
    return {
        ...existing,
        ...patch,
        email: normalizeEmail(patch.email || existing.email),
        providers: {
            ...(existing.providers || {}),
            ...(patch.providers || {})
        },
        profile: {
            ...(existing.profile || {}),
            ...(patch.profile || {})
        },
        updatedAt: nowIso()
    };
}

async function usersCollection() {
    const db = await conectarDB();
    return db.collection('users');
}

async function sessionsCollection() {
    const db = await conectarDB();
    return db.collection('sessions');
}

async function onboardingCollection() {
    const db = await conectarDB();
    return db.collection('onboarding_state');
}

async function findAuthUserByEmail(email) {
    const collection = await usersCollection();
    return collection.findOne({ email: normalizeEmail(email) });
}

async function findAuthUserById(id) {
    const collection = await usersCollection();
    return collection.findOne({ id: String(id || '') });
}

async function saveAuthUser(user) {
    const record = baseUserRecord(user);
    const collection = await usersCollection();
    await collection.updateOne(
        { id: record.id },
        { $set: record },
        { upsert: true }
    );
    return record;
}

async function createAuthUser(data) {
    const user = baseUserRecord(data);
    await saveAuthUser(user);
    return user;
}

async function updateAuthUser(userId, patch = {}) {
    const current = await findAuthUserById(userId);
    if (!current) return null;
    const next = mergeUser(current, patch);
    await saveAuthUser(next);
    return next;
}

async function createSession({ user, provider = 'password', ip, userAgent, expiresAt }) {
    const collection = await sessionsCollection();
    const session = {
        id: crypto.randomUUID(),
        userId: user.id,
        email: normalizeEmail(user.email),
        provider,
        ip: ip || '',
        userAgent: userAgent || '',
        issuedAt: nowIso(),
        lastSeenAt: nowIso(),
        expiresAt,
        revokedAt: null,
        revokedReason: null
    };

    await collection.insertOne(session);
    return session;
}

async function findSessionById(sessionId) {
    const collection = await sessionsCollection();
    return collection.findOne({ id: String(sessionId || '') });
}

async function touchSession(sessionId) {
    const collection = await sessionsCollection();
    await collection.updateOne(
        { id: String(sessionId || ''), revokedAt: null },
        { $set: { lastSeenAt: nowIso() } }
    );
}

async function revokeSession(sessionId, reason = 'manual') {
    const collection = await sessionsCollection();
    await collection.updateOne(
        { id: String(sessionId || '') },
        {
            $set: {
                revokedAt: nowIso(),
                revokedReason: reason
            }
        }
    );
}

async function revokeUserSessions(userId, reason = 'password-reset') {
    const collection = await sessionsCollection();
    await collection.updateMany(
        { userId: String(userId || ''), revokedAt: null },
        {
            $set: {
                revokedAt: nowIso(),
                revokedReason: reason
            }
        }
    );
}

async function ensureOnboardingState(user) {
    const existing = await getOnboardingState(user.id);
    if (existing) return existing;
    const initial = createInitialOnboardingState(user);
    const collection = await onboardingCollection();
    await collection.insertOne(initial);
    return sanitizeOnboardingState(initial);
}

async function getOnboardingState(userId) {
    const collection = await onboardingCollection();
    const state = await collection.findOne({ userId: String(userId || '') });
    return sanitizeOnboardingState(state);
}

async function saveOnboardingState(userId, input = {}) {
    const current = await getOnboardingState(userId) || {
        userId: String(userId || ''),
        email: '',
        currentStep: 'verify-email',
        completedSteps: [],
        data: {},
        completedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        lastActiveAt: nowIso()
    };
    const merged = mergeOnboardingState(current, input);
    const collection = await onboardingCollection();
    await collection.updateOne(
        { userId: String(userId || '') },
        { $set: merged },
        { upsert: true }
    );
    return sanitizeOnboardingState(merged);
}

async function completeOnboardingStep(userId, step, data = {}) {
    const normalized = normalizeStep(step);
    if (!normalized) {
        throw new Error('Etapa de onboarding inválida.');
    }
    return saveOnboardingState(userId, {
        step: normalized,
        data,
        completed: true
    });
}

async function syncLegacyUserRecord(user) {
    const email = normalizeEmail(user.email);
    if (!email) return null;

    const existing = await obterUsuario(email);
    const profile = user.profile || {};
    const now = nowIso();
    const next = existing ? { ...existing } : {
        email,
        createdAt: user.createdAt || now,
        bankReports: generateBankReports(email)
    };

    next.email = email;
    next.authUserId = user.id;
    next.updatedAt = now;
    next.emailVerifiedAt = user.emailVerifiedAt || next.emailVerifiedAt || null;
    next.nome = next.nome || profile.name || '';
    next.fantasia = next.fantasia || profile.name || '';
    next.picture = profile.avatarUrl || next.picture || '';
    next.plano = user.plan || next.plano || 'freemium';
    next.templateKey = user.templateKey || next.templateKey || '';
    next.usageType = profile.usageType || next.usageType || '';
    if (!Array.isArray(next.bankReports) || !next.bankReports.length) {
        next.bankReports = generateBankReports(email);
    }

    await salvarUsuario(next);
    return next;
}

async function updateAuthAndLegacyUser(userId, patch = {}) {
    const user = await updateAuthUser(userId, patch);
    if (!user) return null;
    await syncLegacyUserRecord(user);
    return user;
}

module.exports = {
    baseUserRecord,
    sanitizeOnboardingState,
    findAuthUserByEmail,
    findAuthUserById,
    saveAuthUser,
    createAuthUser,
    updateAuthUser,
    updateAuthAndLegacyUser,
    createSession,
    findSessionById,
    touchSession,
    revokeSession,
    revokeUserSessions,
    ensureOnboardingState,
    getOnboardingState,
    saveOnboardingState,
    completeOnboardingStep,
    syncLegacyUserRecord
};
