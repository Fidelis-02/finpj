const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { obterUsuario, salvarUsuario } = require('../../../src/services/database');
const jwt = require('jsonwebtoken');

/**
 * Dependências necessárias (Roteiro de Instalação):
 * npm install passport passport-google-oauth20 express-session jsonwebtoken
 * 
 * Variáveis de ambiente necessárias (.env):
 * GOOGLE_CLIENT_ID=seu_client_id
 * GOOGLE_CLIENT_SECRET=seu_client_secret
 * GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
 * JWT_SECRET=seu_jwt_secret
 * SESSION_SECRET=seu_session_secret
 */

module.exports = function initGoogleAuth(app, passport) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.warn('SSO Google: GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não definidos.');
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
            const email = profile.emails[0].value;
            let user = await obterUsuario(email);

            if (!user) {
                // Registro inicial (SSO Just-in-Time Provisioning)
                user = {
                    email: email,
                    nome: profile.displayName,
                    provedor: 'google',
                    googleId: profile.id,
                    dataCriacao: new Date().toISOString()
                };
                await salvarUsuario(user);
            } else if (!user.googleId) {
                // Atualizar usuário existente com Google ID
                user.googleId = profile.id;
                user.provedor = 'google';
                await salvarUsuario(user);
            }

            return done(null, user);
        } catch (error) {
            return done(error, null);
        }
    }));

    // Iniciar fluxo de autenticação
    app.get('/api/auth/google',
        passport.authenticate('google', { scope: ['profile', 'email'] })
    );

    // Callback de retorno do Google
    app.get('/api/auth/google/callback',
        passport.authenticate('google', { failureRedirect: '/login?erro=sso_falhou' }),
        (req, res) => {
            // Sucesso na autenticação
            const token = jwt.sign(
                { email: req.user.email, provider: 'google' }, 
                process.env.JWT_SECRET, 
                { expiresIn: '24h' }
            );

            // Redirecionar para o frontend com o token (via URL ou cookie seguro)
            // Aqui enviamos via Query Param para fins de demonstração e o frontend captura
            res.redirect(`/#dashboard?token=${token}&email=${encodeURIComponent(req.user.email)}`);
        }
    );
};
