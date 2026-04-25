require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const passport = require('passport');
const session = require('express-session');
const helmet = require('helmet');

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

// Security headers with helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://api.groq.com", "https://connect.pluggy.ai"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"]
        }
    },
    hsts: process.env.NODE_ENV === 'production' ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    } : false,
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true
}));

app.use(cors({
    origin: (origin, callback) => {
        // Permitir requisições sem origin (como mobile apps ou curl)
        if (!origin) return callback(null, true);

        // Permitir origins explicitamente configurados
        if (allowedOrigins.includes(origin)) return callback(null, true);

        // Permitir apenas o domínio principal da aplicação em produção
        if (process.env.NODE_ENV === 'production') {
            const productionDomain = process.env.PRODUCTION_DOMAIN || 'finpj.vercel.app';
            if (origin === `https://${productionDomain}`) return callback(null, true);
        }

        console.warn(`CORS rejeitado para a origem: ${origin}`);
        callback(new Error('Not allowed by CORS'));
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
    return bodyParser.json({ limit: '50mb' })(req, res, next);
});

app.use((req, res, next) => {
    if (isStripeWebhookRequest(req)) return next();
    return bodyParser.urlencoded({ limit: '50mb', extended: true })(req, res, next);
});

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

// Servir arquivos estáticos da pasta public (frontend e tax engine)
app.use(express.static('public'));

app.use('/api', apiRoutes);

app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ erro: 'Arquivo muito grande. Envie um arquivo de até 50 MB.' });
    }

    if (err.type === 'entity.too.large' || err.status === 413 || err.message?.includes('FUNCTION_PAYLOAD_TOO_LARGE')) {
        return res.status(413).json({ 
            erro: 'Arquivo excede limite de 4.5 MB da Vercel.',
            solucao: 'O sistema deve usar upload direto ao R2 automaticamente. Recarregue a página e tente novamente. Se persistir, contate o suporte.',
            usarR2: true,
            maxSizeVercel: '4.5mb',
            maxSizeR2: '50mb'
        });
    }

    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ erro: 'JSON inválido na requisição.' });
    }

    console.error('Erro não tratado:', err.message || err);
    // In production, don't expose detailed error messages
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const errorMessage = isDevelopment ? (err.message || 'Erro interno do servidor.') : 'Erro interno do servidor.';
    return res.status(err.status || 500).json({ erro: errorMessage });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`FinPJ backend em http://localhost:${PORT}`);
    });
}

module.exports = app;
