const fetchImpl = global.fetch ? global.fetch.bind(global) : require('node-fetch');

const { signOAuthState, verifyOAuthState } = require('./authTokens');

function resolveBaseUrl() {
    return process.env.BASE_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || `http://localhost:${process.env.PORT || 3001}`;
}

function getProviderConfig(provider) {
    const baseUrl = resolveBaseUrl();
    const configs = {
        google: {
            provider: 'google',
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackUrl: process.env.GOOGLE_CALLBACK_URL || `${baseUrl}/api/auth/oauth/google/callback`,
            authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            tokenUrl: 'https://oauth2.googleapis.com/token',
            profileUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
            scopes: ['openid', 'email', 'profile']
        },
        github: {
            provider: 'github',
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            callbackUrl: process.env.GITHUB_CALLBACK_URL || `${baseUrl}/api/auth/oauth/github/callback`,
            authorizeUrl: 'https://github.com/login/oauth/authorize',
            tokenUrl: 'https://github.com/login/oauth/access_token',
            profileUrl: 'https://api.github.com/user',
            emailUrl: 'https://api.github.com/user/emails',
            scopes: ['read:user', 'user:email']
        }
    };
    return configs[String(provider || '').trim().toLowerCase()] || null;
}

function assertProviderConfigured(provider) {
    const config = getProviderConfig(provider);
    if (!config) {
        throw new Error('Provedor OAuth não suportado.');
    }
    if (!config.clientId || !config.clientSecret) {
        throw new Error(`OAuth ${config.provider} não configurado.`);
    }
    return config;
}

function buildOAuthStartUrl(provider, options = {}) {
    const config = assertProviderConfigured(provider);
    const state = signOAuthState({
        provider: config.provider,
        mode: options.mode || 'login',
        returnTo: options.returnTo || '/dashboard'
    });

    const url = new URL(config.authorizeUrl);
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', config.callbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', config.scopes.join(' '));
    url.searchParams.set('state', state);

    if (config.provider === 'google') {
        url.searchParams.set('access_type', 'online');
        url.searchParams.set('prompt', 'consent');
    }

    return {
        provider: config.provider,
        state,
        url: url.toString()
    };
}

async function exchangeOAuthCode(provider, code) {
    const config = assertProviderConfigured(provider);
    const params = new URLSearchParams();
    params.set('client_id', config.clientId);
    params.set('client_secret', config.clientSecret);
    params.set('code', String(code || ''));
    params.set('redirect_uri', config.callbackUrl);

    if (config.provider === 'google') {
        params.set('grant_type', 'authorization_code');
    }

    const response = await fetchImpl(config.tokenUrl, {
        method: 'POST',
        headers: config.provider === 'github'
            ? { Accept: 'application/json' }
            : { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    });

    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json')
        ? await response.json()
        : Object.fromEntries(new URLSearchParams(await response.text()));

    if (!response.ok || body.error) {
        throw new Error(body.error_description || body.error || `Falha ao autenticar com ${config.provider}.`);
    }

    return body;
}

async function fetchGoogleProfile(accessToken) {
    const response = await fetchImpl('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const body = await response.json();
    if (!response.ok || !body.email) {
        throw new Error('Não foi possível obter o perfil do Google.');
    }
    return {
        provider: 'google',
        providerAccountId: body.sub,
        email: body.email,
        name: body.name || body.given_name || '',
        avatarUrl: body.picture || '',
        emailVerified: Boolean(body.email_verified)
    };
}

async function fetchGithubProfile(accessToken) {
    const [userResponse, emailResponse] = await Promise.all([
        fetchImpl('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github+json',
                'User-Agent': 'FinPJ Auth'
            }
        }),
        fetchImpl('https://api.github.com/user/emails', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github+json',
                'User-Agent': 'FinPJ Auth'
            }
        })
    ]);

    const user = await userResponse.json();
    const emails = await emailResponse.json();
    if (!userResponse.ok) {
        throw new Error(user?.message || 'Não foi possível obter o perfil do GitHub.');
    }
    if (!emailResponse.ok || !Array.isArray(emails)) {
        throw new Error('Não foi possível obter o e-mail do GitHub.');
    }

    const primary = emails.find((item) => item.primary && item.verified) || emails.find((item) => item.verified);
    if (!primary?.email) {
        throw new Error('O GitHub não retornou um e-mail verificado para esta conta.');
    }

    return {
        provider: 'github',
        providerAccountId: String(user.id || ''),
        email: primary.email,
        name: user.name || user.login || '',
        avatarUrl: user.avatar_url || '',
        emailVerified: Boolean(primary.verified)
    };
}

async function fetchOAuthProfile(provider, tokenResponse) {
    const accessToken = tokenResponse.access_token;
    if (!accessToken) {
        throw new Error('Token de acesso OAuth ausente.');
    }
    if (provider === 'google') return fetchGoogleProfile(accessToken);
    if (provider === 'github') return fetchGithubProfile(accessToken);
    throw new Error('Provedor OAuth não suportado.');
}

function parseOAuthState(state) {
    return verifyOAuthState(state);
}

module.exports = {
    resolveBaseUrl,
    getProviderConfig,
    assertProviderConfigured,
    buildOAuthStartUrl,
    exchangeOAuthCode,
    fetchOAuthProfile,
    parseOAuthState
};
