require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const passport = require('passport');
const session = require('express-session');

// Configuração do DB e Rotas
const { conectarDB } = require('./src/services/database');
const apiRoutes = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3001;

// Conecta ao DB na inicialização
conectarDB().catch(console.error);

// Middlewares
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.JWT_SECRET || 'finpj-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24h
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

// Autenticações OAuth (Se arquivos existirem)
try {
    const initGoogleAuth = require('./api/auth/google/init.js');
    initGoogleAuth(app, passport);
} catch (e) {
    console.log('Google Auth module not found or failed to load.');
}

try {
    const initAuth0 = require('./api/auth/auth0/init.js');
    initAuth0(app, passport);
} catch (e) {
    console.log('Auth0 module not found or failed to load.');
}

// Rotas estáticas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/logo.svg', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(path.join(__dirname, 'public', 'logo.svg'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rotas da API Centralizadas
app.use('/api', apiRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ erro: 'Payload muito grande. Limite máximo: 10MB.' });
    }
    if (err.status === 413) {
        return res.status(413).json({ erro: 'Payload muito grande. Limite máximo: 10MB.' });
    }
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ erro: 'JSON inválido na requisição.' });
    }
    console.error('Erro não tratado:', err.message || err);
    res.status(err.status || 500).json({ erro: err.message || 'Erro interno do servidor.' });
});

app.listen(PORT, () => {
    console.log(`
====================================
FinPJ Backend rodando 🚀 (Refatorado)
====================================

http://localhost:${PORT}

====================================
`);
});

module.exports = app;