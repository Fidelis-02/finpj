const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { obterUsuario, obterUsuarioPorCnpj, salvarUsuario, formatarEmail } = require('../services/database');
const { enviarEmailVerificacao } = require('../services/emailService');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('JWT_SECRET environment variable is NOT set. Auth endpoints will return 500 until configured.');
}
const CODE_EXPIRY_MS = 10 * 60 * 1000;

function validarEmail(email) {
    return typeof email === 'string' && email.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function gerarCodigoVerificacao() {
    return String(Math.floor(100000 + Math.random() * 900000));
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

function montarDashboard(usuario) {
    const safeUser = {
        email: usuario.email,
        createdAt: usuario.createdAt,
        lastLogin: usuario.lastLogin || usuario.createdAt,
        fantasia: usuario.fantasia || usuario.nome || '',
        nome: usuario.nome || ''
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

async function sendCode(req, res) {
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
        console.error('Falha ao enviar email:', err.message);
    }

    const semSmtp = !process.env.MAIL_HOST && !process.env.GMAIL_USER;
    const isDev = process.env.NODE_ENV !== 'production';
    const resBody = { sucesso: true, mensagem: `Código enviado para ${emailNorm}` };
    if (isDev && semSmtp) {
        resBody._devCode = codigo;
        resBody.mensagem = `[DEV] Código gerado (sem SMTP configurado): ${codigo}`;
        console.log(`\n🔑 CÓDIGO OTP para ${emailNorm}: ${codigo}\n`);
    }
    res.json(resBody);
}

async function verifyCode(req, res) {
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

    if (!JWT_SECRET) return res.status(500).json({ erro: 'Server misconfiguration: JWT_SECRET não configurado.' });
    const token = jwt.sign({ email: usuario.email }, JWT_SECRET, { expiresIn: '7d' });
    const dashboard = montarDashboard(usuario);

    res.json({ sucesso: true, token, dashboard });
}

async function loginCnpj(req, res) {
    const { cnpj, password } = req.body || {};
    if (!cnpj || !password) {
        return res.status(400).json({ erro: 'CNPJ e senha são obrigatórios' });
    }
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

    if (!JWT_SECRET) return res.status(500).json({ erro: 'Server misconfiguration: JWT_SECRET não configurado.' });
    const token = jwt.sign({ email: usuario.email }, JWT_SECRET, { expiresIn: '7d' });
    const dashboard = montarDashboard(usuario);
    res.json({ sucesso: true, token, email: usuario.email, dashboard });
}

async function registerCnpj(req, res) {
    const { cnpj, password, plan } = req.body || {};
    if (!cnpj || !password || password.length < 6) {
        return res.status(400).json({ erro: 'CNPJ e senha (mínimo 6 caracteres) são obrigatórios' });
    }
    const cnpjNorm = String(cnpj).replace(/\D/g, '');
    if (cnpjNorm.length !== 14) {
        return res.status(400).json({ erro: 'CNPJ inválido. Informe os 14 dígitos.' });
    }

    const emailSistema = `cnpj-${cnpjNorm}@finpj.local`;

    // Busca por CNPJ ou pelo Email de Sistema para evitar qualquer brecha de duplicidade
    const [existentePorCnpj, existentePorEmail] = await Promise.all([
        obterUsuarioPorCnpj(cnpjNorm),
        obterUsuario(emailSistema)
    ]);

    if (existentePorCnpj || existentePorEmail) {
        return res.status(400).json({ erro: 'CNPJ já cadastrado no sistema. Por favor, faça login.' });
    }

    const usuario = {
        cnpj: cnpjNorm,
        passwordHash: await bcrypt.hash(password, 10),
        email: emailSistema,
        plano: plan || 'starter',
        createdAt: new Date().toISOString(),
        bankReports: gerarRelatorioBancario(emailSistema)
    };

    await salvarUsuario(usuario);
    res.json({ sucesso: true, mensagem: 'Conta criada com sucesso. Agora faça login com seu CNPJ.' });
}

async function getDashboard(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) {
        return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }
    res.json({ sucesso: true, dashboard: montarDashboard(usuario) });
}

module.exports = {
    sendCode,
    verifyCode,
    loginCnpj,
    registerCnpj,
    getDashboard,
    montarDashboard
};
