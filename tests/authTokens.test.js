const test = require('node:test');
const assert = require('node:assert/strict');

// Use a cryptographically secure test secret or generate dynamically
process.env.JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(64).toString('hex');

delete require.cache[require.resolve('../src/services/authTokens')];
const {
    validatePassword,
    hashPassword,
    comparePassword,
    createScopedOpaqueToken,
    parseScopedOpaqueToken,
    issueSessionToken,
    verifySessionToken,
    signOAuthState,
    verifyOAuthState
} = require('../src/services/authTokens');

test('validatePassword enforces minimum strength', () => {
    const shortPassword = validatePassword('1234567');
    const noNumber = validatePassword('abcdefgh');
    const valid = validatePassword('abc12345');

    assert.equal(shortPassword.valid, false);
    assert.equal(noNumber.valid, false);
    assert.equal(valid.valid, true);
});

test('hashPassword and comparePassword are compatible', async () => {
    const password = 'Finpj123';
    const hash = await hashPassword(password);

    assert.notEqual(hash, password);
    assert.equal(await comparePassword(password, hash), true);
    assert.equal(await comparePassword('other-pass', hash), false);
});

test('scoped opaque token keeps user identity and hashed secret', () => {
    const created = createScopedOpaqueToken('user-123');
    const parsed = parseScopedOpaqueToken(created.token);

    assert.equal(parsed.userId, 'user-123');
    assert.equal(parsed.tokenHash, created.tokenHash);
    assert.equal(parseScopedOpaqueToken('invalid-token'), null);
});

test('session token and oauth state can be signed and verified', () => {
    const session = issueSessionToken({
        userId: 'user-123',
        sessionId: 'session-456',
        email: 'User@Example.com',
        provider: 'password'
    });
    const payload = verifySessionToken(session.token);

    assert.equal(payload.sub, 'user-123');
    assert.equal(payload.sid, 'session-456');
    assert.equal(payload.email, 'user@example.com');

    const state = signOAuthState({
        provider: 'google',
        mode: 'login',
        returnTo: '/dashboard'
    });
    const statePayload = verifyOAuthState(state);

    assert.equal(statePayload.provider, 'google');
    assert.equal(statePayload.mode, 'login');
    assert.equal(statePayload.returnTo, '/dashboard');
});
