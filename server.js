require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const passport = require('passport');
const uri = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'finpj-secret-default';
const MAIL_FROM = process.env.MAIL_FROM || 'FinPJ <no-reply@finpj.com>';
const CODE_EXPIRY_MS = 10 * 60 * 1000;
let mongoClient = null;
let db = null;

async function conectarDB() {
    if (!uri) return null;
    if (!mongoClient) {
        mongoClient = new MongoClient(uri);
        await mongoClient.connect();
        db = mongoClient.db('finpj');
    }
    return db;
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Rota raiz — garante que index.html é servido no / (Vercel)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota /login — serve index.html (JS abre o modal automaticamente)
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Session middleware (required by passport-auth0 / OAuth2 state management)
const session = require('express-session');
app.use(session({
    secret: process.env.JWT_SECRET || 'finpj-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24h
    }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Passport session serialization (required for OAuth flows)
passport.serializeUser((user, done) => {
    done(null, user.email || user.id || user);
});
passport.deserializeUser((id, done) => {
    done(null, { email: id });
});

// Initialize Google OAuth (only if credentials are provided)
const initGoogleAuth = require('./api/auth/google/init.js');
initGoogleAuth(app, passport);

// Initialize Auth0 OAuth (only if credentials are provided)
const initAuth0 = require('./api/auth/auth0/init.js');
initAuth0(app, passport);

// ===============================
// CACHE DE CNPJ (performance)
// ===============================
const cacheCNPJ = {};

const FETCH_HEADERS = {
    'User-Agent': 'FinPJ/1.0 (https://github.com/finpj-app; contato comercial)',
    Accept: 'application/json'
};

function timeoutSignal(ms) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        return AbortSignal.timeout(ms);
    }
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), ms);
    return ctrl.signal;
}

function parseJsonBody(text) {
    const t = String(text || '').trim();
    if (!t || t.startsWith('<') || t.toLowerCase().includes('forbidden')) return null;
    try {
        return JSON.parse(t);
    } catch {
        return null;
    }
}

function mapBrasilApiCnpj(data) {
    if (!data || typeof data !== 'object') return null;
    if (data.type === 'bad_request') return null;
    if (!data.razao_social && !data.cnpj) return null;

    const situacao = String(data.descricao_situacao_cadastral || '').toUpperCase();
    const situacaoNum = String(data.codigo_situacao_cadastral || '');
    const ativo =
        situacao.includes('ATIV') ||
        situacaoNum === '02' ||
        situacaoNum === '2';

    return {
        ativo,
        nome: data.razao_social || '',
        fantasia: data.nome_fantasia || '',
        uf: data.uf,
        municipio: data.municipio,
        cnae_fiscal: data.cnae_fiscal != null ? String(data.cnae_fiscal) : '',
        cnae_descricao: data.cnae_fiscal_descricao || '',
        cnae: data.cnae_fiscal_descricao || '',
        fonte: 'brasilapi'
    };
}

function mapReceitaWsCnpj(data) {
    if (!data || typeof data !== 'object') return null;
    if (data.status === 'ERROR') return null;

    const ap = Array.isArray(data.atividade_principal) ? data.atividade_principal[0] : null;
    const codeRaw = ap && ap.code ? String(ap.code) : '';
    const cnaeDigits = codeRaw.replace(/\D/g, '').slice(0, 7);

    const situacao = String(data.situacao || '').toUpperCase();
    const ativo = situacao.includes('ATIV');

    return {
        ativo,
        nome: data.nome || '',
        fantasia: data.fantasia || '',
        uf: data.uf,
        municipio: data.municipio,
        cnae_fiscal: cnaeDigits || '',
        cnae_descricao: ap && ap.text ? ap.text : '',
        cnae: ap && ap.text ? ap.text : '',
        fonte: 'receitaws'
    };
}

async function consultarCnpjBrasilApi(cnpj) {
    const url = `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;
    const response = await fetch(url, {
        headers: FETCH_HEADERS,
        signal: timeoutSignal(14000)
    });
    const text = await response.text();
    const data = parseJsonBody(text);
    if (!data) {
        return { ok: false, status: response.status, data: null };
    }
    const mapped = mapBrasilApiCnpj(data);
    if (response.ok && mapped) {
        return { ok: true, mapped };
    }
    return { ok: false, status: response.status, data };
}

async function consultarCnpjReceitaWs(cnpj) {
    const url = `https://www.receitaws.com.br/v1/cnpj/${cnpj}`;
    const response = await fetch(url, {
        headers: FETCH_HEADERS,
        signal: timeoutSignal(20000)
    });
    const text = await response.text();
    const data = parseJsonBody(text);
    if (!data) return { ok: false };
    const mapped = mapReceitaWsCnpj(data);
    if (mapped) return { ok: true, mapped };
    const msg = data.message || 'CNPJ não encontrado';
    return { ok: false, erro: msg };
}

// ===============================
// ROTA CNPJ (BrasilAPI + fallback ReceitaWS)
// ===============================
app.get('/api/cnpj', async (req, res) => {
    const cnpj = (req.query.cnpj || '').replace(/\D/g, '');

    if (cnpj.length !== 14) {
        return res.status(400).json({ erro: 'CNPJ inválido' });
    }

    if (cacheCNPJ[cnpj]) {
        return res.json(cacheCNPJ[cnpj]);
    }

    try {
        const b = await consultarCnpjBrasilApi(cnpj);
        if (b.ok && b.mapped) {
            cacheCNPJ[cnpj] = b.mapped;
            return res.json(b.mapped);
        }

        const r = await consultarCnpjReceitaWs(cnpj);
        if (r.ok && r.mapped) {
            cacheCNPJ[cnpj] = r.mapped;
            return res.json(r.mapped);
        }

        const msg =
            (b.data && b.data.message) ||
            r.erro ||
            'Não foi possível localizar este CNPJ nas bases públicas.';
        return res.status(404).json({ ativo: false, erro: msg });
    } catch (err) {
        console.error(err);
        const detalhe = err && err.name === 'AbortError' ? 'Tempo esgotado ao consultar o CNPJ.' : 'Falha de rede ao consultar o CNPJ.';
        return res.status(502).json({ erro: detalhe });
    }
});

// ===============================
// BANCO LOCAL JSON
// ===============================
const isVercel = !!process.env.VERCEL;
const dadosFileSrc = path.join(__dirname, 'dados.json');
const dadosFile = isVercel ? '/tmp/dados.json' : dadosFileSrc;

// Na Vercel, copia dados.json do bundle para /tmp na primeira execução
function garantirDadosNoTmp() {
    if (isVercel && !fs.existsSync(dadosFile)) {
        try {
            if (fs.existsSync(dadosFileSrc)) {
                fs.copyFileSync(dadosFileSrc, dadosFile);
            } else {
                fs.writeFileSync(dadosFile, JSON.stringify({ diagnosticos: [], usuarios: [], bankReports: [] }, null, 2));
            }
        } catch (e) {
            console.error('Erro ao criar dados.json em /tmp:', e.message);
        }
    }
}
garantirDadosNoTmp();

function lerDados() {
    try {
        garantirDadosNoTmp();
        if (fs.existsSync(dadosFile)) {
            const conteudo = fs.readFileSync(dadosFile, 'utf-8');
            const parsed = JSON.parse(conteudo);
            return {
                diagnosticos: parsed.diagnosticos || [],
                usuarios: parsed.usuarios || [],
                bankReports: parsed.bankReports || [],
                analises: parsed.analises || []
            };
        }
    } catch (e) {
        console.log('Criando novo arquivo de dados...');
    }
    return { diagnosticos: [], usuarios: [], bankReports: [], analises: [] };
}

function salvarDados(dados) {
    try {
        fs.writeFileSync(dadosFile, JSON.stringify(dados, null, 2));
    } catch (e) {
        console.error('Erro ao salvar dados:', e.message);
    }
}

function criarTransportadorEmail() {
    // Try to use SMTP if configured
    if (process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS) {
        return nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            port: Number(process.env.MAIL_PORT) || 587,
            secure: process.env.MAIL_SECURE === 'true',
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS
            }
        });
    }
    
    // Fallback: Log to console in development, implement with a real service in production
    return {
        sendMail: async (mailOptions) => {
            // Log email details for development
            if (process.env.NODE_ENV !== 'production') {
                console.log('📧 EMAIL SIMULADO (Desenvolvimento):');
                console.log(`   Para: ${mailOptions.to}`);
                console.log(`   Assunto: ${mailOptions.subject}`);
                console.log(`   Corpo: ${mailOptions.text}`);
                console.log('---');
                return { messageId: 'dev-' + Date.now() };
            }
            
            // In production, throw error to alert about missing SMTP config
            throw new Error(
                'Email service not configured. Set MAIL_HOST, MAIL_USER, and MAIL_PASS environment variables, ' +
                'or use a service like SendGrid, Resend, or AWS SES.'
            );
        }
    };
}

async function enviarEmailVerificacao(email, code) {
    const transport = criarTransportadorEmail();
    const mailOptions = {
        from: MAIL_FROM,
        to: email,
        subject: 'Seu código de acesso FinPJ',
        text: `Seu código FinPJ é: ${code}\nUse-o em até 10 minutos para continuar.`,
        html: `
            <div style="font-family: Montserrat, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #0A2540 0%, #1D74F2 100%); padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #FFFFFF; margin: 0; font-size: 24px;">FinPJ</h1>
                </div>
                <h2 style="color: #0A2540; margin-bottom: 16px;">Seu código de acesso</h2>
                <p style="color: #5A6B7D; line-height: 1.6; margin-bottom: 20px;">
                    Use o código abaixo para acessar sua conta FinPJ. Ele expira em 10 minutos.
                </p>
                <div style="background: #F0F5FF; border: 2px solid #1D74F2; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                    <p style="font-size: 36px; font-weight: 700; letter-spacing: 4px; color: #1D74F2; margin: 0;">${code}</p>
                </div>
                <p style="color: #5A6B7D; font-size: 12px; margin-bottom: 24px;">
                    Se você não solicitou este código, ignore este e-mail.
                </p>
                <div style="border-top: 1px solid #D9E2F0; padding-top: 16px; color: #8B95A7; font-size: 12px; text-align: center;">
                    <p style="margin: 0;">© 2024 FinPJ. Todos os direitos reservados.</p>
                </div>
            </div>
        `
    };
    
    try {
        const result = await transport.sendMail(mailOptions);
        console.log('✅ Email enviado com sucesso:', result.messageId || result);
        return result;
    } catch (error) {
        console.error('❌ Erro ao enviar email:', error.message);
        // In development, don't throw - allow the app to continue
        if (process.env.NODE_ENV === 'production') {
            throw error;
        }
        // Log the code for manual verification in development
        console.log(`📌 Código para ${email}: ${code}`);
    }
}

function gerarCodigoVerificacao() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function validarEmail(email) {
    return typeof email === 'string' && email.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function formatarEmail(email) {
    return String(email || '').trim().toLowerCase();
}

async function obterUsuario(email) {
    const emailNorm = formatarEmail(email);
    if (!db && uri) {
        await conectarDB();
    }
    if (db) {
        const usuario = await db.collection('usuarios').findOne({ email: emailNorm });
        if (usuario) return usuario;
    }
    const dados = lerDados();
    return dados.usuarios.find(u => u.email === emailNorm);
}

async function obterUsuarioPorCnpj(cnpj) {
    const cnpjNorm = String(cnpj || '').replace(/\D/g, '');
    if (!db && uri) {
        await conectarDB();
    }
    if (db) {
        const usuario = await db.collection('usuarios').findOne({ cnpj: cnpjNorm });
        if (usuario) return usuario;
    }
    const dados = lerDados();
    return dados.usuarios.find(u => u.cnpj === cnpjNorm);
}

async function salvarUsuario(usuario) {
    usuario.email = formatarEmail(usuario.email);
    if (!db && uri) {
        await conectarDB();
    }
    if (db) {
        await db.collection('usuarios').updateOne({ email: usuario.email }, { $set: usuario }, { upsert: true });
        return usuario;
    }
    const dados = lerDados();
    const index = dados.usuarios.findIndex(u => u.email === usuario.email);
    if (index >= 0) {
        dados.usuarios[index] = usuario;
    } else {
        dados.usuarios.push(usuario);
    }
    salvarDados(dados);
    return usuario;
}

function gerarRelatorioBancario(email) {
    const hoje = new Date();
    const tipos = [
        'Conciliação de extrato',
        'Revisão de lançamentos',
        'Atualização de saldo',
        'Alerta de fluxo de caixa',
        'Análise de recebimentos',
        'Detectamos uma diferença bancária'
    ];
    return Array.from({ length: 6 }, (_, i) => {
        const data = new Date(hoje);
        data.setDate(hoje.getDate() - i);
        const valor = Math.round((Math.random() * 18 + 3) * 1000);
        return {
            id: `${email}-${data.toISOString().slice(0, 10)}-${i}`,
            date: data.toISOString().slice(0, 10),
            title: tipos[i % tipos.length],
            detail: `Atualização diária para a empresa ${email.split('@')[0]} com informações de extrato e movimentações bancárias.`,
            amount: valor,
            status: i % 2 === 0 ? 'Concluído' : 'Atenção'
        };
    });
}

function gerarRelatoriosBancarios(email) {
    return gerarRelatorioBancario(email);
}

function montarDashboard(usuario) {
    const safeUser = {
        email: usuario.email,
        createdAt: usuario.createdAt,
        lastLogin: usuario.lastLogin || usuario.createdAt
    };
    const reports = usuario.bankReports && usuario.bankReports.length ? usuario.bankReports : gerarRelatorioBancario(usuario.email);
    usuario.bankReports = reports;
    salvarUsuario(usuario);
    const totalMovimentado = reports.reduce((sum, item) => sum + item.amount, 0);
    return {
        user: safeUser,
        summary: {
            reportsCount: reports.length,
            totalMovimentado,
            pendencias: reports.filter(r => r.status !== 'Concluído').length
        },
        reports
    };
}

function extrairToken(req) {
    const header = req.headers.authorization || req.headers.Authorization;
    if (!header || typeof header !== 'string') return null;
    const parts = header.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
    return parts[1];
}

async function verificarToken(req) {
    const token = extrairToken(req);
    if (!token) return null;
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

// Middleware de autenticação para rotas protegidas
function verificarTokenMiddleware(req, res, next) {
    const token = extrairToken(req);
    if (!token) return res.status(401).json({ erro: 'Token obrigatório.' });
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.userEmail = payload.email;
        next();
    } catch {
        return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }
}

app.post('/api/auth/send-code', async (req, res) => {
    const { email } = req.body;
    if (!validarEmail(email)) {
        return res.status(400).json({ erro: 'Email inválido' });
    }
    const emailNorm = formatarEmail(email);
    const codigo = gerarCodigoVerificacao();
    const hash = await bcrypt.hash(codigo, 10);

    let usuario = await obterUsuario(emailNorm);
    if (!usuario) {
        usuario = {
            email: emailNorm,
            createdAt: new Date().toISOString(),
            bankReports: gerarRelatorioBancario(emailNorm)
        };
    }

    usuario.verificationCodeHash = hash;
    usuario.codeExpiresAt = Date.now() + CODE_EXPIRY_MS;
    usuario.lastCodeSentAt = new Date().toISOString();
    await salvarUsuario(usuario);

    let emailEnviado = false;
    try {
        await enviarEmailVerificacao(emailNorm, codigo);
        emailEnviado = true;
    } catch (err) {
        console.error('Falha ao enviar email:', err.message);
    }

    // Em desenvolvimento sem SMTP configurado, retorna o código na resposta
    const semSmtp = !process.env.MAIL_HOST && !process.env.GMAIL_USER;
    const isDev = process.env.NODE_ENV !== 'production';
    const resBody = { sucesso: true, mensagem: `Código enviado para ${emailNorm}` };
    if (isDev && semSmtp) {
        resBody._devCode = codigo;
        resBody.mensagem = `[DEV] Código gerado (sem SMTP configurado): ${codigo}`;
        console.log(`\n🔑 CÓDIGO OTP para ${emailNorm}: ${codigo}\n`);
    }
    res.json(resBody);
});

app.post('/api/auth/verify-code', async (req, res) => {
    const { email, code } = req.body;
    if (!validarEmail(email) || !code || String(code).trim().length === 0) {
        return res.status(400).json({ erro: 'Email e código são obrigatórios' });
    }
    const emailNorm = formatarEmail(email);
    const usuario = await obterUsuario(emailNorm);
    if (!usuario || !usuario.verificationCodeHash) {
        return res.status(400).json({ erro: 'Código de verificação incorreto ou expirado.' });
    }
    if (Date.now() > usuario.codeExpiresAt) {
        return res.status(400).json({ erro: 'O código expirou. Solicite um novo código.' });
    }
    const valido = await bcrypt.compare(String(code), usuario.verificationCodeHash);
    if (!valido) {
        return res.status(400).json({ erro: 'Código de verificação incorreto.' });
    }

    usuario.lastLogin = new Date().toISOString();
    delete usuario.verificationCodeHash;
    delete usuario.codeExpiresAt;
    delete usuario.lastCodeSentAt;
    await salvarUsuario(usuario);

    const token = jwt.sign({ email: usuario.email }, JWT_SECRET, { expiresIn: '7d' });
    const dashboard = montarDashboard(usuario);

    res.json({ sucesso: true, token, dashboard });
});

app.get('/api/dashboard', async (req, res) => {
    const payload = await verificarToken(req);
    if (!payload || !payload.email) {
        return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }
    const usuario = await obterUsuario(payload.email);
    if (!usuario) {
        return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }
    res.json({ sucesso: true, dashboard: montarDashboard(usuario) });
});

// ===============================
// NOVAS ROTAS DE AUTENTICAÇÃO
// ===============================
app.post('/api/auth/login-cnpj', async (req, res) => {
    const { cnpj, password } = req.body || {};
    if (!cnpj || !password) {
        return res.status(400).json({ erro: 'CNPJ e senha são obrigatórios' });
    }
    // Normaliza para dígitos antes de buscar
    const cnpjNorm = String(cnpj).replace(/\D/g, '');
    const usuario = await obterUsuarioPorCnpj(cnpjNorm);
    if (!usuario || !usuario.passwordHash) {
        return res.status(400).json({ erro: 'CNPJ ou senha incorretos.' });
    }

    const isValid = await bcrypt.compare(password, usuario.passwordHash);
    if (!isValid) {
        return res.status(400).json({ erro: 'CNPJ ou senha incorretos.' });
    }

    usuario.lastLogin = new Date().toISOString();
    await salvarUsuario(usuario);

    const token = jwt.sign({ email: usuario.email }, JWT_SECRET, { expiresIn: '7d' });
    const dashboard = montarDashboard(usuario);
    res.json({ sucesso: true, token, email: usuario.email, dashboard });
});

app.post('/api/auth/register-cnpj', async (req, res) => {
    const { cnpj, password } = req.body || {};
    if (!cnpj || !password || password.length < 6) {
        return res.status(400).json({ erro: 'CNPJ e senha (mínimo 6 caracteres) são obrigatórios' });
    }
    // SEMPRE normaliza CNPJ para só dígitos antes de salvar
    const cnpjNorm = String(cnpj).replace(/\D/g, '');
    if (cnpjNorm.length !== 14) {
        return res.status(400).json({ erro: 'CNPJ inválido. Informe os 14 dígitos.' });
    }

    let usuario = await obterUsuarioPorCnpj(cnpjNorm);
    if (usuario) {
        return res.status(400).json({ erro: 'CNPJ já cadastrado. Faça login.' });
    }

    usuario = {
        cnpj: cnpjNorm,
        passwordHash: await bcrypt.hash(password, 10),
        email: `cnpj-${cnpjNorm}@finpj.local`,
        createdAt: new Date().toISOString(),
        bankReports: gerarRelatoriosBancarios(`cnpj-${cnpjNorm}`)
    };

    await salvarUsuario(usuario);
    res.json({ sucesso: true, mensagem: 'Conta criada com sucesso. Agora faça login.' });
});

// ===============================
// ROTA 1: DIAGNÓSTICO
// ===============================
app.post('/api/diagnosticos', async (req, res) => {
    const { nome, cnpj, setor, regime, faturamento, margem } = req.body;

    if (!nome || !cnpj) {
        return res.status(400).json({ erro: 'Nome e CNPJ são obrigatórios' });
    }

    const fat = parseInt(faturamento) || 4800000;
    const marg = parseFloat(margem) || 0.12;

    const impostoSimples = fat * 0.11;
    const impostoPresumido = fat * 0.15;
    const impostoReal = (fat * marg) * 0.24;

    const regimeIdeal =
        impostoSimples < impostoPresumido && impostoSimples < impostoReal
            ? 'Simples Nacional'
            : impostoPresumido < impostoReal
            ? 'Lucro Presumido'
            : 'Lucro Real';

    const impostoIdeal = Math.min(impostoSimples, impostoPresumido, impostoReal);
    const economia = Math.max(impostoSimples, impostoPresumido, impostoReal) - impostoIdeal;

    const creditosIdentificados = fat * 0.05;
    const anomaliaValor = Math.random() > 0.5 ? fat * 0.01 : 0;

    const diagnostico = {
        id: Date.now(),
        nome,
        cnpj,
        setor,
        regime,
        faturamento: fat,
        margem: marg,
        data: new Date().toISOString(),
        resultados: {
            regimeIdeal,
            impostoIdeal: Math.round(impostoIdeal),
            economia: Math.round(economia),
            creditosIdentificados: Math.round(creditosIdentificados),
            anomaliaValor: Math.round(anomaliaValor),
            impostos: {
                simples: Math.round(impostoSimples),
                presumido: Math.round(impostoPresumido),
                real: Math.round(impostoReal)
            }
        }
    };

    const analise = await gerarAnaliseFinanceira(diagnostico);
    diagnostico.resultados = {
        ...diagnostico.resultados,
        resumo: analise.resumo,
        recomendacoes: analise.recomendacoes
    };

    const dados = lerDados();
    dados.diagnosticos.push(diagnostico);
    salvarDados(dados);

    res.json({
        sucesso: true,
        id: diagnostico.id,
        resultados: diagnostico.resultados
    });
});

// ===============================
// ROTA 2: GET POR ID
// ===============================
app.get('/api/diagnosticos/:id', (req, res) => {
    const { id } = req.params;
    const dados = lerDados();
    const diagnostico = dados.diagnosticos.find(d => d.id == id);

    if (!diagnostico) {
        return res.status(404).json({ erro: 'Diagnóstico não encontrado' });
    }

    res.json(diagnostico);
});

// ===============================
// ROTA 3: LISTAR
// ===============================
app.get('/api/diagnosticos', (req, res) => {
    const dados = lerDados();
    res.json(dados.diagnosticos);
});

// ===============================
// ROTA 4: DELETE
// ===============================
app.delete('/api/diagnosticos/:id', (req, res) => {
    const { id } = req.params;
    const dados = lerDados();

    dados.diagnosticos = dados.diagnosticos.filter(d => d.id != id);
    salvarDados(dados);

    res.json({ sucesso: true });
});

// ===============================
// HEALTH CHECK
// ===============================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString()
    });
});

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? require('stripe')(stripeSecretKey) : null;

function obterValorPlano(plano) {
    const valores = {
        'starter': 490,
        'growth': 950,
        'enterprise': 1850
    };
    return valores[plano] || 490;
}

function fmtReais(valor) {
    return 'R$ ' + Math.round(Number(valor) || 0).toLocaleString('pt-BR');
}

function gerarAnaliseInterna(diagnostico) {
    const { faturamento, margem, regime, setor, resultados } = diagnostico;
    const economia = resultados.economia || 0;
    const creditos = resultados.creditosIdentificados || 0;
    const anomalia = resultados.anomaliaValor || 0;
    const percentualEconomia = faturamento > 0 ? Math.round((economia / faturamento) * 100) : 0;

    const recomendacoes = [];
    recomendacoes.push(`Revisar o regime tributário: o regime ideal apontado é ${resultados.regimeIdeal}.`);
    if (percentualEconomia >= 8) {
        recomendacoes.push('Há uma oportunidade elevada de economia fiscal, priorize ajustes no planejamento tributário.');
    } else {
        recomendacoes.push('A economia projetada é moderada; mantenha o acompanhamento mensal da carga tributária.');
    }
    if (creditos > 0) {
        recomendacoes.push(`Identificamos até ${fmtReais(creditos)} em créditos tributários: valide a recuperação desses saldos com seu contador.`);
    }
    if (anomalia > 0) {
        recomendacoes.push(`Detectamos uma possível anomalia de custo de ${fmtReais(anomalia)}; verifique despesas não usuais e fluxo de caixa.`);
    }

    const resumo = `Este diagnóstico sugere ${resultados.regimeIdeal} como melhor opção fiscal e indica até ${fmtReais(economia)} de economia anual, com ${fmtReais(creditos)} em créditos tributários identificados.`;
    return {
        resumo,
        recomendacoes
    };
}

async function gerarAnaliseFinanceira(diagnostico) {
    if (!process.env.OPENAI_API_KEY) {
        return gerarAnaliseInterna(diagnostico);
    }

    try {
        const prompt = `Você é um analista financeiro para PMEs no Brasil. Com base nos dados abaixo, gere um resumo conciso e três recomendações práticas de melhoria financeira e tributária.`;
        const mensagem = `Dados do diagnóstico:\nNome: ${diagnostico.nome}\nCNPJ: ${diagnostico.cnpj}\nSetor: ${diagnostico.setor}\nRegime atual: ${diagnostico.regime}\nFaturamento anual: R$ ${diagnostico.faturamento.toLocaleString('pt-BR')}\nMargem: ${diagnostico.margem}\nEconomia estimada: R$ ${diagnostico.resultados.economia}\nCréditos identificados: R$ ${diagnostico.resultados.creditosIdentificados}\nAnomalia identificada: R$ ${diagnostico.resultados.anomaliaValor}\nRegime ideal: ${diagnostico.resultados.regimeIdeal}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: mensagem }
                ],
                max_tokens: 250,
                temperature: 0.6
            })
        });

        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content;
        if (!content) {
            return gerarAnaliseInterna(diagnostico);
        }

        return { resumo: String(content).trim(), recomendacoes: [] };
    } catch (error) {
        console.error('OpenAI analysis error:', error);
        return gerarAnaliseInterna(diagnostico);
    }
}

// Rota para processar pagamento
app.post('/api/pagamento', async (req, res) => {
    if (!stripe) {
        return res.status(500).json({ erro: 'Stripe não está configurado. Defina STRIPE_SECRET_KEY.' });
    }

    const { email, plano } = req.body;
    const valor = obterValorPlano(plano);

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: 'brl',
                        product_data: {
                            name: `FinPJ - Plano ${plano}`
                        },
                        unit_amount: valor * 100
                    },
                    quantity: 1
                }
            ],
            customer_email: email,
            success_url: `${req.protocol}://${req.get('host')}/?pagamento=sucesso`,
            cancel_url: `${req.protocol}://${req.get('host')}/?pagamento=cancelado`
        });

        res.json({ sucesso: true, checkoutUrl: session.url });
    } catch (erro) {
        console.error('Stripe checkout error:', erro);
        res.status(500).json({ erro: 'Erro ao criar sessão de pagamento. Tente novamente mais tarde.' });
    }
});

// ===============================
// UPLOAD & ANÁLISE DE DOCUMENTOS (IA)
// ===============================
const multer = require('multer');
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/csv', 'text/plain'];
        if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|xlsx|xls|csv|txt|ods)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('Formato não suportado. Use PDF, Excel, CSV ou TXT.'));
        }
    }
});

async function extrairTextoPDF(buffer) {
    try {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        return data.text || '';
    } catch (e) {
        console.error('PDF parse error:', e.message);
        return '';
    }
}

function extrairTextoExcel(buffer) {
    try {
        const XLSX = require('xlsx');
        const wb = XLSX.read(buffer, { type: 'buffer' });
        let texto = '';
        wb.SheetNames.forEach(name => {
            const ws = wb.Sheets[name];
            const csv = XLSX.utils.sheet_to_csv(ws);
            texto += `=== Aba: ${name} ===\n${csv}\n\n`;
        });
        return texto;
    } catch (e) {
        console.error('Excel parse error:', e.message);
        return '';
    }
}

async function analisarComGroq(tipoDoc, textoDoc, contexto = '') {
    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_KEY) {
        return analisarLocalmente(tipoDoc, textoDoc);
    }
    const prompts = {
        dre: `Você é um analista financeiro especialista em PMEs brasileiras. Analise o DRE abaixo e retorne JSON com:
{"receita_bruta": number, "deducoes": number, "receita_liquida": number, "custos": number, "lucro_bruto": number, "despesas_operacionais": number, "ebitda": number, "lucro_liquido": number, "margem_bruta_pct": number, "margem_liquida_pct": number, "alertas": ["string"], "recomendacoes": ["string"], "resumo": "string"}`,
        balanco: `Você é um analista financeiro especialista em PMEs. Analise o Balanço Patrimonial e retorne JSON com:
{"ativo_total": number, "ativo_circulante": number, "ativo_nao_circulante": number, "passivo_total": number, "passivo_circulante": number, "patrimonio_liquido": number, "liquidez_corrente": number, "endividamento_pct": number, "alertas": ["string"], "recomendacoes": ["string"], "resumo": "string"}`,
        extrato: `Você é um especialista em conciliação bancária. Analise o extrato bancário e retorne JSON com:
{"saldo_inicial": number, "saldo_final": number, "total_entradas": number, "total_saidas": number, "num_transacoes": number, "categorias": [{"nome": "string", "valor": number}], "anomalias": ["string"], "itens_conciliacao": [{"data": "string", "descricao": "string", "valor": number, "tipo": "entrada|saida", "categoria": "string", "flag": "string"}], "recomendacoes": ["string"], "resumo": "string"}`
    };

    const systemPrompt = prompts[tipoDoc] || prompts.dre;
    const texto = textoDoc.slice(0, 12000); // Groq context limit safety

    try {
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Documento:\n\n${texto}\n\nContexto adicional: ${contexto}\n\nRetorne SOMENTE o JSON, sem markdown, sem explicações.` }
                ],
                max_tokens: 2000,
                temperature: 0.2
            })
        });
        const payload = await resp.json();
        const content = payload?.choices?.[0]?.message?.content || '';
        const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        return { sucesso: true, dados: JSON.parse(jsonStr), fonte: 'groq-llama3' };
    } catch (e) {
        console.error('Groq error:', e.message);
        return analisarLocalmente(tipoDoc, textoDoc);
    }
}

function analisarLocalmente(tipoDoc, texto) {
    const numeros = (texto.match(/[\d.]+,\d{2}/g) || [])
        .map(n => parseFloat(n.replace(/\./g, '').replace(',', '.')))
        .filter(n => !isNaN(n) && n > 0);
    const soma = numeros.reduce((a, b) => a + b, 0);
    const max = numeros.length ? Math.max(...numeros) : 0;

    if (tipoDoc === 'extrato') {
        const entradas = numeros.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
        const saidas = numeros.filter((_, i) => i % 2 !== 0).reduce((a, b) => a + b, 0);
        return {
            sucesso: true,
            dados: {
                saldo_inicial: 0, saldo_final: entradas - saidas,
                total_entradas: entradas, total_saidas: saidas,
                num_transacoes: numeros.length,
                categorias: [{ nome: 'Outros', valor: soma }],
                anomalias: soma > 100000 ? ['Movimentação elevada detectada'] : [],
                recomendacoes: ['Configure a integração Groq para análise detalhada por IA'],
                resumo: `Extrato processado com ${numeros.length} valores identificados. Saldo líquido estimado: R$ ${(entradas - saidas).toLocaleString('pt-BR')}.`
            },
            fonte: 'local'
        };
    }
    return {
        sucesso: true,
        dados: {
            receita_bruta: max, deducoes: max * 0.08, receita_liquida: max * 0.92,
            custos: max * 0.45, lucro_bruto: max * 0.47,
            despesas_operacionais: max * 0.25, ebitda: max * 0.22, lucro_liquido: max * 0.12,
            margem_bruta_pct: 47, margem_liquida_pct: 12,
            alertas: ['Análise local aproximada — configure GROQ_API_KEY para análise por IA'],
            recomendacoes: ['Obtenha chave gratuita em console.groq.com para análise completa'],
            resumo: `Documento processado localmente. ${numeros.length} valores financeiros identificados.`
        },
        fonte: 'local'
    };
}

app.post('/api/upload-documento', verificarTokenMiddleware, upload.single('arquivo'), async (req, res) => {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
    const { tipo = 'dre', contexto = '' } = req.body;

    let texto = '';
    const mime = req.file.mimetype;
    const nome = req.file.originalname.toLowerCase();

    if (mime === 'application/pdf' || nome.endsWith('.pdf')) {
        texto = await extrairTextoPDF(req.file.buffer);
    } else if (nome.match(/\.(xlsx|xls|ods)$/)) {
        texto = extrairTextoExcel(req.file.buffer);
    } else {
        texto = req.file.buffer.toString('utf-8');
    }

    if (!texto.trim()) {
        return res.status(422).json({ erro: 'Não foi possível extrair texto do documento. Tente um PDF com texto selecionável ou Excel.' });
    }

    const analise = await analisarComGroq(tipo, texto, contexto);

    // Salva a análise no histórico do usuário
    const dados = lerDados();
    if (!dados.analises) dados.analises = [];
    dados.analises.push({
        id: Date.now(),
        email: req.userEmail,
        tipo,
        nomeArquivo: req.file.originalname,
        tamanho: req.file.size,
        data: new Date().toISOString(),
        resultado: analise.dados,
        fonte: analise.fonte
    });
    salvarDados(dados);

    res.json({ sucesso: true, ...analise, nomeArquivo: req.file.originalname });
});

// ===============================
// CONCILIAÇÃO BANCÁRIA
// ===============================
app.post('/api/conciliacao', verificarTokenMiddleware, async (req, res) => {
    const { transacoes = [], lancamentos = [] } = req.body;
    // Concilia: busca pares com valores iguais e datas próximas
    const conciliados = [];
    const naoEncontrados = [];
    const usados = new Set();

    transacoes.forEach(t => {
        const match = lancamentos.find((l, i) => {
            if (usados.has(i)) return false;
            const valorOk = Math.abs(parseFloat(l.valor) - parseFloat(t.valor)) < 0.01;
            const dataOk = Math.abs(new Date(l.data) - new Date(t.data)) < 5 * 24 * 3600000; // 5 dias
            return valorOk && dataOk;
        });
        if (match) {
            const idx = lancamentos.indexOf(match);
            usados.add(idx);
            conciliados.push({ extrato: t, sistema: match, status: 'conciliado' });
        } else {
            naoEncontrados.push({ extrato: t, status: 'pendente', motivo: 'Não encontrado nos lançamentos' });
        }
    });

    const resumo = {
        total: transacoes.length,
        conciliados: conciliados.length,
        pendentes: naoEncontrados.length,
        percentualConciliado: transacoes.length ? Math.round((conciliados.length / transacoes.length) * 100) : 0
    };
    res.json({ sucesso: true, resumo, conciliados, pendentes: naoEncontrados });
});

// ===============================
// HISTÓRICO DE ANÁLISES
// ===============================
app.get('/api/analises', verificarTokenMiddleware, (req, res) => {
    const dados = lerDados();
    const analises = (dados.analises || []).filter(a => a.email === req.userEmail);
    res.json({ sucesso: true, analises });
});

// ===============================
// CHAT IA (Groq)
// ===============================
app.post('/api/chat', verificarTokenMiddleware, async (req, res) => {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ erro: 'Mensagem obrigatória.' });
    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_KEY) return res.json({ sucesso: true, resposta: 'Configure GROQ_API_KEY para usar o chat IA.', fonte: 'local' });
    try {
        const usuario = await obterUsuario(req.userEmail);
        const banks = usuario?.connectedBanks || [];
        const txSummary = banks.flatMap(b => (b.transactions || []).slice(0, 5).map(t => `${t.data}: ${t.descricao} R$${t.valor}`)).join('\n');
        const sysPrompt = `Você é o assistente financeiro FinPJ para PMEs brasileiras. Responda de forma concisa e prática em português. Dados do usuário:\n- Email: ${req.userEmail}\n- Bancos conectados: ${banks.length}\n- Últimas transações:\n${txSummary || 'Nenhuma'}\n${context || ''}`;
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: message }], max_tokens: 1000, temperature: 0.4 })
        });
        const payload = await resp.json();
        const content = payload?.choices?.[0]?.message?.content || 'Não consegui processar sua pergunta.';
        res.json({ sucesso: true, resposta: content, fonte: 'groq-llama3' });
    } catch (e) { console.error('Chat error:', e); res.json({ sucesso: true, resposta: 'Erro ao processar. Tente novamente.', fonte: 'error' }); }
});

// ===============================
// NOTIFICAÇÕES
// ===============================
app.get('/api/notifications', verificarTokenMiddleware, async (req, res) => {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    const notifs = [];
    const banks = usuario.connectedBanks || [];
    const totalTx = banks.reduce((s, b) => s + (b.transactions || []).length, 0);
    if (banks.length === 0) notifs.push({ id: 'no-bank', tipo: 'info', msg: 'Conecte um banco via Open Finance para importar transações.', data: new Date().toISOString() });
    banks.forEach(b => {
        const lastSync = new Date(b.lastSync);
        const diffDays = Math.floor((Date.now() - lastSync) / 86400000);
        if (diffDays > 3) notifs.push({ id: `sync-${b.bankId}`, tipo: 'warning', msg: `${b.bankName}: última sincronização há ${diffDays} dias.`, data: b.lastSync });
        const saidas = (b.transactions || []).filter(t => t.tipo === 'saida');
        const maxSaida = saidas.reduce((m, t) => Math.max(m, Math.abs(t.valor)), 0);
        if (maxSaida > 10000) notifs.push({ id: `alert-${b.bankId}`, tipo: 'danger', msg: `${b.bankName}: saída de R$ ${maxSaida.toLocaleString('pt-BR')} detectada.`, data: new Date().toISOString() });
    });
    const hoje = new Date();
    const dia = hoje.getDate();
    if (dia >= 15 && dia <= 20) notifs.push({ id: 'das', tipo: 'warning', msg: 'Prazo do DAS/Simples Nacional se aproxima (dia 20).', data: hoje.toISOString() });
    if (dia >= 20 && dia <= 25) notifs.push({ id: 'darf', tipo: 'warning', msg: 'Prazo de DARF/PIS/COFINS se aproxima (dia 25).', data: hoje.toISOString() });
    res.json({ sucesso: true, notifications: notifs });
});

// ===============================
// CALENDÁRIO FISCAL
// ===============================
app.get('/api/fiscal-calendar', verificarTokenMiddleware, (req, res) => {
    const hoje = new Date();
    const mes = hoje.getMonth();
    const ano = hoje.getFullYear();
    const eventos = [
        { dia: 7, titulo: 'FGTS', desc: 'Recolhimento do FGTS', tipo: 'imposto' },
        { dia: 10, titulo: 'GPS/INSS', desc: 'Guia da Previdência Social', tipo: 'imposto' },
        { dia: 15, titulo: 'ISS', desc: 'Imposto Sobre Serviços (municipal)', tipo: 'imposto' },
        { dia: 20, titulo: 'DAS', desc: 'Documento de Arrecadação do Simples Nacional', tipo: 'imposto' },
        { dia: 20, titulo: 'IRRF', desc: 'Imposto de Renda Retido na Fonte', tipo: 'imposto' },
        { dia: 25, titulo: 'PIS/COFINS', desc: 'Contribuição PIS e COFINS', tipo: 'imposto' },
        { dia: 25, titulo: 'ICMS', desc: 'Imposto sobre Circulação de Mercadorias', tipo: 'imposto' },
        { dia: 28, titulo: 'CSLL', desc: 'Contribuição Social sobre o Lucro Líquido', tipo: 'imposto' },
        { dia: 1, titulo: 'Folha', desc: 'Processamento da folha de pagamento', tipo: 'rh' },
        { dia: 5, titulo: 'Pro-labore', desc: 'Pagamento de pro-labore aos sócios', tipo: 'rh' },
        { dia: 30, titulo: 'Balanço', desc: 'Fechamento contábil mensal', tipo: 'contabil' },
    ].map(e => ({ ...e, data: new Date(ano, mes, e.dia).toISOString().slice(0, 10), passado: e.dia < hoje.getDate() }));
    res.json({ sucesso: true, eventos, mesAtual: `${ano}-${String(mes + 1).padStart(2, '0')}` });
});

// ===============================
// PROJEÇÃO DE FLUXO DE CAIXA
// ===============================
app.get('/api/cashflow-projection', verificarTokenMiddleware, async (req, res) => {
    const usuario = await obterUsuario(req.userEmail);
    const banks = usuario?.connectedBanks || [];
    const allTx = banks.flatMap(b => b.transactions || []);
    const entradas = allTx.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Math.abs(t.valor), 0);
    const saidas = allTx.filter(t => t.tipo === 'saida').reduce((s, t) => s + Math.abs(t.valor), 0);
    const mediaDiariaE = entradas / Math.max(1, allTx.length / 2);
    const mediaDiariaS = saidas / Math.max(1, allTx.length / 2);
    const projecao = [];
    let saldo = entradas - saidas;
    for (let i = 1; i <= 90; i++) {
        const d = new Date(); d.setDate(d.getDate() + i);
        const e = mediaDiariaE * (0.8 + Math.random() * 0.4);
        const s = mediaDiariaS * (0.7 + Math.random() * 0.6);
        saldo += e - s;
        if (i % 7 === 0 || i <= 7) projecao.push({ data: d.toISOString().slice(0, 10), entrada: Math.round(e), saida: Math.round(s), saldo: Math.round(saldo) });
    }
    res.json({ sucesso: true, projecao, saldoAtual: Math.round(entradas - saidas), mediaEntrada: Math.round(mediaDiariaE), mediaSaida: Math.round(mediaDiariaS) });
});

// ===============================
// CALCULADORA DAS/DARF
// ===============================
app.post('/api/calcular-das', verificarTokenMiddleware, (req, res) => {
    const { faturamento, regime, atividade } = req.body;
    const fat = Number(faturamento) || 0;
    if (fat <= 0) return res.status(400).json({ erro: 'Informe o faturamento.' });
    let aliq, valor, guia, vencimento;
    const hoje = new Date();
    const proxMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 20);
    vencimento = proxMes.toISOString().slice(0, 10);
    if (regime === 'simples') {
        if (fat <= 180000) aliq = 0.06; else if (fat <= 360000) aliq = 0.112; else if (fat <= 720000) aliq = 0.135;
        else if (fat <= 1800000) aliq = 0.16; else if (fat <= 3600000) aliq = 0.21; else aliq = 0.33;
        if (atividade === 'comercio') aliq *= 0.85;
        valor = Math.round((fat / 12) * aliq);
        guia = 'DAS';
    } else if (regime === 'presumido') {
        const base = atividade === 'comercio' ? fat * 0.08 : fat * 0.32;
        valor = Math.round((base * 0.15 + Math.max(0, base - 240000) * 0.10 + base * 0.09 + fat * 0.0925) / 12);
        aliq = valor / (fat / 12);
        guia = 'DARF';
    } else {
        valor = Math.round((fat * 0.12 * 0.34 + fat * 0.0925) / 12);
        aliq = valor / (fat / 12);
        guia = 'DARF';
    }
    res.json({ sucesso: true, guia, valor, aliquotaEfetiva: (aliq * 100).toFixed(2), vencimento, faturamentoMensal: Math.round(fat / 12) });
});

// ===============================
// PERFIL DO USUÁRIO
// ===============================
app.get('/api/profile', verificarTokenMiddleware, async (req, res) => {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    const { verificationCodeHash, codeExpiresAt, passwordHash, ...safe } = usuario;
    res.json({ sucesso: true, profile: safe });
});

app.put('/api/profile', verificarTokenMiddleware, async (req, res) => {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    const { nomeEmpresa, cnpj, regime, setor } = req.body;
    if (nomeEmpresa) usuario.nomeEmpresa = nomeEmpresa;
    if (cnpj) usuario.cnpj = cnpj.replace(/\D/g, '');
    if (regime) usuario.regime = regime;
    if (setor) usuario.setor = setor;
    await salvarUsuario(usuario);
    res.json({ sucesso: true });
});

// ===============================
// TAGS EM TRANSAÇÕES
// ===============================
app.post('/api/openfinance/transactions/:txId/tags', verificarTokenMiddleware, async (req, res) => {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    const { tag, nota } = req.body;
    const banks = usuario.connectedBanks || [];
    for (const bank of banks) {
        const tx = (bank.transactions || []).find(t => t.id === req.params.txId);
        if (tx) { tx.tag = tag || tx.tag; tx.nota = nota || tx.nota; break; }
    }
    await salvarUsuario(usuario);
    res.json({ sucesso: true });
});

// ===============================
// OPEN FINANCE — CONEXÃO BANCÁRIA
// ===============================
function gerarTransacoesMock(bankName) {
    const tipos = [
        { desc: 'PIX Recebido', tipo: 'entrada', cat: 'Receita' },
        { desc: 'PIX Enviado', tipo: 'saida', cat: 'Transferência' },
        { desc: 'Boleto Pago', tipo: 'saida', cat: 'Fornecedor' },
        { desc: 'TED Recebida', tipo: 'entrada', cat: 'Receita' },
        { desc: 'Tarifa Bancária', tipo: 'saida', cat: 'Taxa' },
        { desc: 'Pagamento Fornecedor', tipo: 'saida', cat: 'Fornecedor' },
        { desc: 'Recebimento Cliente', tipo: 'entrada', cat: 'Receita' },
        { desc: 'DAS Simples Nacional', tipo: 'saida', cat: 'Imposto' },
        { desc: 'Folha de Pagamento', tipo: 'saida', cat: 'RH' },
        { desc: 'Venda Cartão', tipo: 'entrada', cat: 'Receita' },
        { desc: 'Aluguel', tipo: 'saida', cat: 'Operacional' },
        { desc: 'Energia Elétrica', tipo: 'saida', cat: 'Operacional' }
    ];
    const hoje = new Date();
    return Array.from({ length: 15 }, (_, i) => {
        const data = new Date(hoje);
        data.setDate(hoje.getDate() - i);
        const t = tipos[Math.floor(Math.random() * tipos.length)];
        const valor = Math.round((Math.random() * 18 + 0.3) * 1000);
        return {
            id: `${bankName}-${Date.now()}-${i}`,
            data: data.toISOString().slice(0, 10),
            descricao: t.desc,
            valor: t.tipo === 'entrada' ? valor : -valor,
            tipo: t.tipo,
            categoria: t.cat
        };
    });
}

app.get('/api/openfinance/banks', verificarTokenMiddleware, async (req, res) => {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    res.json({ sucesso: true, banks: usuario.connectedBanks || [] });
});

app.post('/api/openfinance/connect', verificarTokenMiddleware, async (req, res) => {
    const { bankId, bankName } = req.body;
    if (!bankId || !bankName) return res.status(400).json({ erro: 'Banco obrigatório.' });
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    if (!usuario.connectedBanks) usuario.connectedBanks = [];
    if (usuario.connectedBanks.find(b => b.bankId === bankId)) {
        return res.status(400).json({ erro: 'Banco já conectado.' });
    }
    const bank = {
        bankId,
        bankName,
        connectedAt: new Date().toISOString(),
        lastSync: new Date().toISOString(),
        status: 'connected',
        accountType: 'Conta Corrente PJ',
        transactions: gerarTransacoesMock(bankName)
    };
    usuario.connectedBanks.push(bank);
    await salvarUsuario(usuario);
    res.json({ sucesso: true, bank });
});

app.post('/api/openfinance/sync/:bankId', verificarTokenMiddleware, async (req, res) => {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    const bank = (usuario.connectedBanks || []).find(b => b.bankId === req.params.bankId);
    if (!bank) return res.status(404).json({ erro: 'Banco não conectado.' });
    bank.lastSync = new Date().toISOString();
    bank.transactions = gerarTransacoesMock(bank.bankName);
    await salvarUsuario(usuario);
    res.json({ sucesso: true, bank });
});

app.delete('/api/openfinance/banks/:bankId', verificarTokenMiddleware, async (req, res) => {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    usuario.connectedBanks = (usuario.connectedBanks || []).filter(b => b.bankId !== req.params.bankId);
    await salvarUsuario(usuario);
    res.json({ sucesso: true });
});

// ===============================
// GLOBAL ERROR HANDLER (garante que erros como 413 sejam JSON)
// ===============================
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

// ===============================
// START
// ===============================
app.listen(PORT, () => {
    console.log(`
====================================
FinPJ Backend rodando 🚀
====================================

http://localhost:${PORT}

====================================
`);
});

module.exports = app;