const test = require('node:test');
const assert = require('node:assert/strict');

const initGoogleAuth = require('../api/auth/google/init.js');

function createAppMock() {
    const routes = new Map();
    return {
        routes,
        get(path, ...handlers) {
            routes.set(path, handlers);
        }
    };
}

test('google auth init exposes disabled status and graceful redirects when env is missing', () => {
    const previousId = process.env.GOOGLE_CLIENT_ID;
    const previousSecret = process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    const app = createAppMock();
    initGoogleAuth(app, {});

    const statusHandlers = app.routes.get('/api/auth/google/status');
    assert.ok(statusHandlers, 'status route should always be registered');

    let statusPayload = null;
    statusHandlers[0]({}, {
        json(payload) {
            statusPayload = payload;
        }
    });
    assert.deepEqual(statusPayload, { provider: 'google', enabled: false });

    const loginHandlers = app.routes.get('/api/auth/google');
    assert.ok(loginHandlers, 'login route should still exist when google is disabled');

    let redirectedTo = '';
    loginHandlers[0]({}, {
        redirect(url) {
            redirectedTo = url;
        }
    });

    assert.match(redirectedTo, /^\/login\?/);
    assert.match(redirectedTo, /oauth_error=/);
    assert.match(redirectedTo, /provider=google/);

    if (previousId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previousId;
    if (previousSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = previousSecret;
});
