const test = require('node:test');
const assert = require('node:assert/strict');

// Use a cryptographically secure test secret or generate dynamically
process.env.JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(64).toString('hex');
process.env.BASE_URL = 'http://localhost:3001';
process.env.GOOGLE_CLIENT_ID = 'google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
process.env.GITHUB_CLIENT_ID = 'github-client-id';
process.env.GITHUB_CLIENT_SECRET = 'github-client-secret';

delete require.cache[require.resolve('../src/services/oauthService')];
const {
    buildOAuthStartUrl,
    parseOAuthState,
    resolveBaseUrl
} = require('../src/services/oauthService');

test('resolveBaseUrl prefers BASE_URL', () => {
    assert.equal(resolveBaseUrl(), 'http://localhost:3001');
});

test('buildOAuthStartUrl for google returns a signed state and provider URL', () => {
    const result = buildOAuthStartUrl('google', {
        mode: 'login',
        returnTo: '/dashboard'
    });
    const url = new URL(result.url);
    const statePayload = parseOAuthState(result.state);

    assert.equal(result.provider, 'google');
    assert.equal(url.hostname, 'accounts.google.com');
    assert.equal(url.searchParams.get('client_id'), 'google-client-id');
    assert.equal(statePayload.provider, 'google');
    assert.equal(statePayload.returnTo, '/dashboard');
});

test('buildOAuthStartUrl for github uses the configured callback and scopes', () => {
    const result = buildOAuthStartUrl('github', {
        mode: 'signup',
        returnTo: '/onboarding/perfil'
    });
    const url = new URL(result.url);
    const statePayload = parseOAuthState(result.state);

    assert.equal(result.provider, 'github');
    assert.equal(url.hostname, 'github.com');
    assert.equal(url.searchParams.get('client_id'), 'github-client-id');
    assert.match(url.searchParams.get('scope'), /user:email/);
    assert.equal(statePayload.mode, 'signup');
    assert.equal(statePayload.returnTo, '/onboarding/perfil');
});
