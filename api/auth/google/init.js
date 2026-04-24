const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { obterUsuario, salvarUsuario } = require('../../../src/services/database');
const jwt = require('jsonwebtoken');

const GOOGLE_UNAVAILABLE_MESSAGE = 'Google SSO indisponivel no momento. Use email, CNPJ, codigo ou Auth0.';

function isGoogleConfigured() {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectToLoginWithError(res, message = GOOGLE_UNAVAILABLE_MESSAGE) {
    const query = new URLSearchParams({
        oauth_error: message,
        provider: 'google'
    });
    return res.redirect(`/login?${query.toString()}`);
}

module.exports = function initGoogleAuth(app, passport) {
    const googleEnabled = isGoogleConfigured();

    app.get('/api/auth/google/status', (req, res) => {
        return res.json({
            provider: 'google',
            enabled: googleEnabled
        });
    });

    if (!googleEnabled) {
        console.warn('SSO Google: GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET nao definidos.');
        app.get('/api/auth/google', (req, res) => redirectToLoginWithError(res));
        app.get('/api/auth/google/callback', (req, res) => redirectToLoginWithError(res));
        return;
    }

    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
                return done(new Error('O Google nao retornou um e-mail valido.'), null);
            }

            let user = await obterUsuario(email);

            if (!user) {
                user = {
                    email,
                    nome: profile.displayName,
                    provedor: 'google',
                    googleId: profile.id,
                    dataCriacao: new Date().toISOString()
                };
                await salvarUsuario(user);
            } else if (!user.googleId) {
                user.googleId = profile.id;
                user.provedor = 'google';
                await salvarUsuario(user);
            }

            return done(null, user);
        } catch (error) {
            return done(error, null);
        }
    }));

    app.get('/api/auth/google',
        passport.authenticate('google', { scope: ['profile', 'email'] })
    );

    app.get('/api/auth/google/callback',
        passport.authenticate('google', { failureRedirect: '/login?oauth_error=Falha%20ao%20autenticar%20com%20Google.&provider=google' }),
        (req, res) => {
            if (!process.env.JWT_SECRET) {
                return redirectToLoginWithError(res, 'Google autenticou, mas o servidor esta sem JWT configurado.');
            }

            const token = jwt.sign(
                { email: req.user.email, provider: 'google' },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            const query = new URLSearchParams({
                token,
                email: req.user.email,
                provider: 'google',
                next: '/dashboard'
            });

            return res.redirect(`/?${query.toString()}`);
        }
    );
};
