// Auth0 OAuth endpoints
// These are optional - they only work if AUTH0_DOMAIN, AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET are set

module.exports = function initAuth0(app, passport) {
    const domain = process.env.AUTH0_DOMAIN;
    const clientID = process.env.AUTH0_CLIENT_ID;
    const clientSecret = process.env.AUTH0_CLIENT_SECRET;

    if (!domain || !clientID || !clientSecret) {
        console.log('Auth0 not configured - skipping Auth0 auth routes');
        return;
    }

    const Auth0Strategy = require('passport-auth0');
    const { obterUsuario, salvarUsuario, formatarEmail, gerarRelatorioBancario } = require('../../lib/auth-storage.js');
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'finpj-secret-default';

    const BASE_URL = process.env.BASE_URL || 'https://finpj.vercel.app';

    passport.use('auth0', new Auth0Strategy({
        domain: domain,
        clientID: clientID,
        clientSecret: clientSecret,
        callbackURL: `${BASE_URL}/api/auth/auth0/callback`,
        scope: 'openid profile email'
    }, async (accessToken, refreshToken, extraParams, profile, done) => {
        try {
            const email = formatarEmail(
                (profile.emails && profile.emails[0] && profile.emails[0].value) ||
                profile._json.email ||
                `auth0-${profile.id}@finpj.local`
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

    // If serialize/deserialize are not already set (by Google OAuth), set them
    // passport.serializeUser and deserializeUser are idempotent for our use case
    // since Google init may have already set them

    // =====================
    // LOGIN ROUTE — redirects to Auth0 login page
    // =====================
    app.get('/api/auth/auth0/login', passport.authenticate('auth0', {
        scope: 'openid profile email',
        session: false
    }));

    // =====================
    // CALLBACK ROUTE — Auth0 redirects back here after login
    // =====================
    app.get('/api/auth/auth0/callback', passport.authenticate('auth0', {
        failureRedirect: '/?login=failed',
        session: false
    }), (req, res) => {
        // Generate JWT token (same as Google and email login flows)
        const token = jwt.sign({ email: req.user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.redirect(`/?token=${token}&login=success`);
    });

    // =====================
    // LOGOUT ROUTE — logs out of Auth0 + app
    // =====================
    app.get('/api/auth/auth0/logout', (req, res) => {
        // Build the Auth0 logout URL that redirects back to the app
        const returnTo = encodeURIComponent(BASE_URL);
        const logoutUrl = `https://${domain}/v2/logout?client_id=${clientID}&returnTo=${returnTo}`;
        res.redirect(logoutUrl);
    });

    // =====================
    // USER INFO ROUTE — returns current user info from token
    // =====================
    app.get('/api/auth/auth0/user', async (req, res) => {
        const authorization = req.headers.authorization || req.headers.Authorization;
        if (!authorization || typeof authorization !== 'string') {
            return res.status(401).json({ erro: 'Não autenticado' });
        }
        const parts = authorization.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({ erro: 'Token inválido' });
        }
        try {
            const payload = jwt.verify(parts[1], JWT_SECRET);
            const usuario = await obterUsuario(payload.email);
            if (!usuario) {
                return res.status(404).json({ erro: 'Usuário não encontrado' });
            }
            // Return safe user data (no password hashes)
            const { verificationCodeHash, codeExpiresAt, passwordHash, ...safeUser } = usuario;
            res.json(safeUser);
        } catch {
            return res.status(401).json({ erro: 'Token inválido ou expirado' });
        }
    });

    console.log('✅ Auth0 OAuth configured');
    console.log(`   Login:    ${BASE_URL}/api/auth/auth0/login`);
    console.log(`   Callback: ${BASE_URL}/api/auth/auth0/callback`);
    console.log(`   Logout:   ${BASE_URL}/api/auth/auth0/logout`);
};
