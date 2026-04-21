// Google OAuth endpoints
// These are optional - they only work if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set

module.exports = function initGoogleAuth(app, passport) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.log('Google OAuth not configured - skipping Google auth routes');
        return;
    }

    const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
    const { obterUsuario, salvarUsuario, formatarEmail, montarDashboard, gerarRelatorioBancario } = require('../lib/auth-storage.js');
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
        console.log('JWT_SECRET not configured - skipping Google auth routes');
        return;
    }

    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback'
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = formatarEmail(profile.emails[0].value);
            let usuario = await obterUsuario(email);
            if (!usuario) {
                usuario = {
                    email,
                    googleId: profile.id,
                    name: profile.displayName,
                    createdAt: new Date().toISOString(),
                    bankReports: gerarRelatorioBancario(email)
                };
                await salvarUsuario(usuario);
            } else {
                usuario.lastLogin = new Date().toISOString();
                await salvarUsuario(usuario);
            }
            return done(null, usuario);
        } catch (err) {
            return done(err);
        }
    }));

    passport.serializeUser((usuario, done) => {
        done(null, usuario.email);
    });

    passport.deserializeUser(async (email, done) => {
        try {
            const usuario = await obterUsuario(email);
            done(null, usuario);
        } catch (err) {
            done(err);
        }
    });

    // Routes
    app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

    app.get('/api/auth/google/callback', passport.authenticate('google', { failureRedirect: '/?login=failed' }), (req, res) => {
        const token = jwt.sign({ email: req.user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.redirect(`/?token=${token}&login=success`);
    });
};
