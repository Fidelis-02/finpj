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
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

if (process.env.BASE_URL && !allowedOrigins.includes(process.env.BASE_URL)) {
    allowedOrigins.push(process.env.BASE_URL);
}


app.use(cors({
    origin: (origin, callback) => {
        // Permitir requisições sem origin (como mobile apps ou curl)
        if (!origin) return callback(null, true);
        
        // Verificar se está na lista explícita
        if (allowedOrigins.includes(origin)) return callback(null, true);
        
        // Permitir qualquer subdomínio vercel.app
        if (origin.endsWith('.vercel.app')) return callback(null, true);
        
        console.warn(`CORS rejeitado para a origem: ${origin}`);
        return callback(null, false);
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
app.use('/tax', express.static(path.join(__dirname, 'src', 'tax')));

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'finpj-dev-session-secret';
if (!process.env.SESSION_SECRET && !process.env.JWT_SECRET) {
    console.warn('SESSION_SECRET/JWT_SECRET nao definido. Usando segredo temporario apenas para desenvolvimento local.');
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
