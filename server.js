require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const passport = require('passport');
const session = require('express-session');

const { conectarDB } = require('./src/services/database');
const apiRoutes = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3001;

conectarDB().catch((error) => {
    console.error('Falha ao conectar no MongoDB:', error.message);
});

const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

function isStripeWebhookRequest(req) {
    return req.originalUrl === '/api/webhooks/stripe';
}

app.use((req, res, next) => {
    if (isStripeWebhookRequest(req)) {
        return express.raw({ type: 'application/json' })(req, res, next);
    }
    return next();
});

app.use((req, res, next) => {
    if (isStripeWebhookRequest(req)) return next();
    return bodyParser.json({ limit: '10mb' })(req, res, next);
});

app.use((req, res, next) => {
    if (isStripeWebhookRequest(req)) return next();
    return bodyParser.urlencoded({ limit: '10mb', extended: true })(req, res, next);
});

app.use(express.static(path.join(__dirname, 'public')));

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET;
if (!SESSION_SECRET) {
    console.error('SESSION_SECRET or JWT_SECRET environment variable is required');
    process.exit(1);
}

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user.email || user.id || user);
});

passport.deserializeUser((id, done) => {
    done(null, { email: id });
});

try {
    const initGoogleAuth = require('./api/auth/google/init.js');
    initGoogleAuth(app, passport);
} catch (error) {
    console.log('Google Auth module not found or failed to load.');
}

try {
    const initAuth0 = require('./api/auth/auth0/init.js');
    initAuth0(app, passport);
} catch (error) {
    console.log('Auth0 module not found or failed to load.');
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/logo.svg', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(path.join(__dirname, 'public', 'logo.svg'));
});

app.use('/api', apiRoutes);

app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ erro: 'Arquivo muito grande. Envie um arquivo de até 3,5 MB.' });
    }

    if (err.type === 'entity.too.large' || err.status === 413) {
        return res.status(413).json({ erro: 'Arquivo ou requisição muito grande. Reduza o tamanho e tente novamente.' });
    }

    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ erro: 'JSON inválido na requisição.' });
    }

    console.error('Erro não tratado:', err.message || err);
    return res.status(err.status || 500).json({ erro: err.message || 'Erro interno do servidor.' });
});

app.listen(PORT, () => {
    console.log(`FinPJ backend em http://localhost:${PORT}`);
});

module.exports = app;
