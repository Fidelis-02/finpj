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
const PORT = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

// Passport middleware
app.use(passport.initialize());

// Initialize Google OAuth (only if credentials are provided)
const initGoogleAuth = require('./api/auth/google/init.js');
initGoogleAuth(app, passport);

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
const dadosFile = path.join(__dirname, 'dados.json');

function lerDados() {
    try {
        if (fs.existsSync(dadosFile)) {
            const conteudo = fs.readFileSync(dadosFile, 'utf-8');
            const parsed = JSON.parse(conteudo);
            // Ensure all required arrays exist
            return {
                diagnosticos: parsed.diagnosticos || [],
                usuarios: parsed.usuarios || [],
                bankReports: parsed.bankReports || []
            };
        }
    } catch (e) {
        console.log('Criando novo arquivo de dados...');
    }
    return { diagnosticos: [], usuarios: [], bankReports: [] };
}

function salvarDados(dados) {
    fs.writeFileSync(dadosFile, JSON.stringify(dados, null, 2));
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

    try {
        await enviarEmailVerificacao(emailNorm, codigo);
    } catch (err) {
        console.error('Falha ao enviar email de verificação:', err);
    }

    res.json({ sucesso: true, mensagem: `Código enviado para ${emailNorm}` });
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

    const usuario = await obterUsuarioPorCnpj(cnpj);
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

    let usuario = await obterUsuarioPorCnpj(cnpj);
    if (usuario) {
        return res.status(400).json({ erro: 'CNPJ já cadastrado.' });
    }

    usuario = {
        cnpj,
        passwordHash: await bcrypt.hash(password, 10),
        email: `cnpj-${cnpj}@finpj.local`, // dummy email
        createdAt: new Date().toISOString(),
        bankReports: gerarRelatoriosBancarios(`cnpj-${cnpj}`)
    };

    await salvarUsuario(usuario);

    res.json({ sucesso: true, mensagem: 'Conta criada com sucesso.' });
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
// START
// ===============================
app.listen(PORT, () => {
    console.log(`
====================================
FinPJ Backend rodando 🚀
====================================

http://localhost:${PORT}
http://localhost:${PORT}/finpj-site.html

====================================
`);
});

module.exports = app;