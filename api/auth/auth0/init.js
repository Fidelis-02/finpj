// Auth0 OAuth endpoints
// These are optional - they only work if AUTH0_DOMAIN, AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET are set

module.exports = function initAuth0(app, passport) {
    const domain = process.env.AUTH0_DOMAIN;
    const clientID = process.env.AUTH0_CLIENT_ID;
    const clientSecret = process.env.AUTH0_CLIENT_SECRET;
    const resolvedBaseUrl = process.env.BASE_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || 'https://finpj.vercel.app';

    app.get('/api/auth/auth0/status', (req, res) => {
        res.json({
            configured: !!(domain && clientID && clientSecret),
            domain: domain ? domain.substring(0, 10) + '...' : 'NOT SET',
            clientID: clientID ? clientID.substring(0, 8) + '...' : 'NOT SET',
            clientSecret: clientSecret ? '***SET***' : 'NOT SET',
            baseUrl: resolvedBaseUrl,
            nodeEnv: process.env.NODE_ENV || 'NOT SET'
        });
    });

    function registerUnavailableAuth0Routes(statusCode, message, detail) {
        const payload = { erro: message };
        if (detail) payload.detalhe = detail;

        app.get('/api/auth/auth0/login', (req, res) => {
            res.status(statusCode).json(payload);
        });

        app.get('/api/auth/auth0/callback', (req, res) => {
            const query = new URLSearchParams({
                oauth_error: message,
                provider: 'auth0'
            });
            res.redirect(`/login?${query.toString()}`);
        });

        app.get('/api/auth/auth0/logout', (req, res) => {
            res.redirect('/login');
        });

        app.get('/api/auth/auth0/user', (req, res) => {
            res.status(401).json(payload);
        });
    }

    if (!domain || !clientID || !clientSecret) {
        console.log('Auth0 not configured - skipping Auth0 auth routes');
        registerUnavailableAuth0Routes(
            503,
            'Auth0 nao esta configurado. Verifique as variaveis AUTH0_DOMAIN, AUTH0_CLIENT_ID e AUTH0_CLIENT_SECRET.'
        );
        return;
    }

    try {
        const Auth0Strategy = require('passport-auth0');
        const { obterUsuario, salvarUsuario, formatarEmail, gerarRelatorioBancario } = require('../../lib/auth-storage.js');
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
            throw new Error('JWT_SECRET nao configurado.');
        }

        const BASE_URL = resolvedBaseUrl;

        passport.use('auth0', new Auth0Strategy({
            domain,
            clientID,
            clientSecret,
            callbackURL: `${BASE_URL}/api/auth/auth0/callback`,
            scope: 'openid profile email'
        }, async (accessToken, refreshToken, extraParams, profile, done) => {
            try {
                const email = formatarEmail(
                    (profile.emails && profile.emails[0] && profile.emails[0].value)
                    || profile._json.email
                    || `auth0-${profile.id}@finpj.local`
                );

                let usuario = await obterUsuario(email);
                if (!usuario) {
                    usuario = {
                        email,
                        auth0Id: profile.id,
                        name: profile.displayName || profile._json.name || '',
                        picture: profile._json.picture || '',
                        createdAt: new Date().toISOString(),
                        bankReports: gerarRelatorioBancario(email)
                    };
                    await salvarUsuario(usuario);
                } else {
                    usuario.lastLogin = new Date().toISOString();
                    if (!usuario.auth0Id) usuario.auth0Id = profile.id;
                    if (profile._json.picture) usuario.picture = profile._json.picture;
                    await salvarUsuario(usuario);
                }
                return done(null, usuario);
            } catch (err) {
                return done(err);
            }
        }));

        app.get('/api/auth/auth0/login', passport.authenticate('auth0', {
            scope: 'openid profile email',
            session: false
        }));

        app.get('/api/auth/auth0/callback', passport.authenticate('auth0', {
            failureRedirect: '/?login=failed',
            session: false
        }), (req, res) => {
            const token = jwt.sign({ email: req.user.email, provider: 'auth0' }, JWT_SECRET, { expiresIn: '7d' });
            res.redirect(`/?token=${token}&login=success`);
        });

        app.get('/api/auth/auth0/logout', (req, res) => {
            const returnTo = encodeURIComponent(BASE_URL);
            const logoutUrl = `https://${domain}/v2/logout?client_id=${clientID}&returnTo=${returnTo}`;
            res.redirect(logoutUrl);
        });

        app.get('/api/auth/auth0/user', async (req, res) => {
            const authorization = req.headers.authorization || req.headers.Authorization;
            if (!authorization || typeof authorization !== 'string') {
                return res.status(401).json({ erro: 'Nao autenticado' });
            }
            const parts = authorization.split(' ');
            if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
                return res.status(401).json({ erro: 'Token invalido' });
            }
            try {
                const payload = jwt.verify(parts[1], JWT_SECRET);
                const usuario = await obterUsuario(payload.email);
                if (!usuario) {
                    return res.status(404).json({ erro: 'Usuario nao encontrado' });
                }
                const { verificationCodeHash, codeExpiresAt, passwordHash, ...safeUser } = usuario;
                res.json(safeUser);
            } catch {
                return res.status(401).json({ erro: 'Token invalido ou expirado' });
            }
        });

        console.log('Auth0 OAuth configured');
        console.log(`   Login:    ${BASE_URL}/api/auth/auth0/login`);
        console.log(`   Callback: ${BASE_URL}/api/auth/auth0/callback`);
        console.log(`   Logout:   ${BASE_URL}/api/auth/auth0/logout`);
    } catch (err) {
        console.error('Erro ao inicializar Auth0:', err.message);
        registerUnavailableAuth0Routes(500, 'Falha ao inicializar Auth0.', err.message);
    }
};
