const test = require('node:test');
const assert = require('node:assert/strict');

const initAuth0 = require('../api/auth/auth0/init.js');

function createAppMock() {
    const routes = new Map();
    return {
        routes,
        get(path, ...handlers) {
            routes.set(path, handlers);
        }
    };
}

test('auth0 init registers graceful fallback routes when env is missing', () => {
    const original = {
        AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
        AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET
    };

    delete process.env.AUTH0_DOMAIN;
    delete process.env.AUTH0_CLIENT_ID;
    delete process.env.AUTH0_CLIENT_SECRET;

    const app = createAppMock();
    initAuth0(app, {});

    const expectedRoutes = [
        '/api/auth/auth0/status',
        '/api/auth/auth0/login',
        '/api/auth/auth0/callback',
        '/api/auth/auth0/logout',
        '/api/auth/auth0/user'
    ];
    expectedRoutes.forEach((route) => assert.ok(app.routes.get(route), `route ${route} should exist`));

    let loginStatus = null;
    let loginPayload = null;
    app.routes.get('/api/auth/auth0/login')[0]({}, {
        status(code) {
            loginStatus = code;
            return this;
        },
        json(payload) {
            loginPayload = payload;
        }
    });
    assert.equal(loginStatus, 503);
    assert.match(loginPayload.erro, /Auth0/);

    let redirectedTo = '';
    app.routes.get('/api/auth/auth0/callback')[0]({}, {
        redirect(url) {
            redirectedTo = url;
        }
    });
    assert.match(redirectedTo, /^\/login\?/);
    assert.match(redirectedTo, /provider=auth0/);

    let userStatus = null;
    app.routes.get('/api/auth/auth0/user')[0]({}, {
        status(code) {
            userStatus = code;
            return this;
        },
        json() {}
    });
    assert.equal(userStatus, 401);

    if (original.AUTH0_DOMAIN === undefined) delete process.env.AUTH0_DOMAIN;
    else process.env.AUTH0_DOMAIN = original.AUTH0_DOMAIN;
    if (original.AUTH0_CLIENT_ID === undefined) delete process.env.AUTH0_CLIENT_ID;
    else process.env.AUTH0_CLIENT_ID = original.AUTH0_CLIENT_ID;
    if (original.AUTH0_CLIENT_SECRET === undefined) delete process.env.AUTH0_CLIENT_SECRET;
    else process.env.AUTH0_CLIENT_SECRET = original.AUTH0_CLIENT_SECRET;
});
