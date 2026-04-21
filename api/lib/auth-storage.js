const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const {
    obterUsuario,
    obterUsuarioPorCnpj,
    salvarUsuario,
    formatarEmail
} = require('../../src/services/database');

const JWT_SECRET = process.env.JWT_SECRET;
const MAIL_FROM = process.env.MAIL_FROM || 'FinPJ <no-reply@finpj.com>';
const CODE_EXPIRY_MS = 10 * 60 * 1000;

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

function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

async function gerarCodigoVerificacao() {
    return generateCode();
}

async function hashCode(code) {
    return bcrypt.hash(String(code), 10);
}

async function compareCode(code, hash) {
    return bcrypt.compare(String(code), hash);
}

function criarTransportadorEmail() {
    return nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT) || 587,
        secure: process.env.MAIL_SECURE === 'true',
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS || process.env.BREVO_API_KEY
        }
    });
}

async function sendVerificationEmail(email, code) {
    const transport = criarTransportadorEmail();
    const mailOptions = {
        from: MAIL_FROM,
        to: email,
        subject: 'Seu código de acesso FinPJ',
        text: `Seu código FinPJ é: ${code}\nUse-o em até 10 minutos para continuar.`,
        html: `
            <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0D1117; border-radius: 16px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #1a2744 0%, #0f3460 100%); padding: 32px; text-align: center;">
                    <h1 style="color: #60a5fa; margin: 0; font-size: 28px; letter-spacing: -0.5px;">FinPJ</h1>
                    <p style="color: #94a3b8; margin: 8px 0 0; font-size: 13px;">CFO Digital para PMEs</p>
                </div>
                <div style="padding: 32px; background: #0D1117;">
                    <h2 style="color: #f1f5f9; margin-bottom: 16px; font-size: 20px;">Seu código de acesso</h2>
                    <p style="color: #94a3b8; line-height: 1.6; margin-bottom: 24px;">
                        Use o código abaixo para acessar sua conta FinPJ. Ele expira em <strong style="color: #f1f5f9;">10 minutos</strong>.
                    </p>
                    <div style="background: #1e2d4a; border: 2px solid #3b82f6; border-radius: 12px; padding: 28px; text-align: center; margin-bottom: 24px;">
                        <p style="font-size: 42px; font-weight: 700; letter-spacing: 8px; color: #60a5fa; margin: 0; font-family: monospace;">${code}</p>
                    </div>
                    <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">
                        Se você não solicitou este código, ignore este e-mail com segurança.
                    </p>
                </div>
            </div>
        `
    };

    try {
        const result = await transport.sendMail(mailOptions);
        console.log('E-mail enviado:', result.messageId || 'ok');
        return result;
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error.message);
        console.log(`CÓDIGO PARA ${email}: ${code}`);
    }
}

function validateEmail(email) {
    return typeof email === 'string' && email.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function extractBearerToken(req) {
    const authorization = req.headers.authorization || req.headers.Authorization;
    if (!authorization || typeof authorization !== 'string') return null;
    const parts = authorization.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
    return parts[1];
}

function verifyToken(req) {
    const token = extractBearerToken(req);
    if (!token || !JWT_SECRET) return null;
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

module.exports = {
    obterUsuario,
    obterUsuarioPorCnpj,
    salvarUsuario,
    gerarRelatorioBancario,
    montarDashboard,
    hashCode,
    compareCode,
    formatarEmail,
    generateCode,
    gerarCodigoVerificacao,
    sendVerificationEmail,
    validateEmail,
    extractBearerToken,
    verifyToken,
    JWT_SECRET,
    MAIL_FROM,
    CODE_EXPIRY_MS,
    formatEmail: formatarEmail,
    getUser: obterUsuario,
    getUserByCnpj: obterUsuarioPorCnpj,
    saveUser: salvarUsuario,
    generateBankReports: gerarRelatorioBancario,
    mountDashboard: montarDashboard
};
