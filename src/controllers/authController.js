const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { obterUsuario, obterUsuarioPorCnpj, salvarUsuario, formatarEmail } = require('../services/database');
const { enviarEmailVerificacao } = require('../services/emailService');
const { getFiscalSimulation } = require('../services/fiscalCache');
const taxUtils = require('../tax/utils');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('JWT_SECRET não está configurado. Os endpoints de autenticação retornarão 500 até a configuração.');
}
const CODE_EXPIRY_MS = 10 * 60 * 1000;
const PLANOS_PERMITIDOS = ['starter', 'growth', 'enterprise'];

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

function getBankTransactions(usuario) {
    return (usuario.connectedBanks || []).flatMap((bank) => (bank.transactions || []).map((transaction) => ({
        ...transaction,
        bankId: bank.bankId,
        bankName: bank.bankName || 'Banco'
    })));
}

function sumTransactions(transactions, predicate) {
    return transactions
        .filter(predicate)
        .reduce((sum, item) => sum + Math.abs(Number(item.valor ?? item.amount) || 0), 0);
}

function isReportDone(report) {
    const status = String(report?.status || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    return status.includes('conclu');
}

function buildDashboardMetrics(usuario, reports, totalMovimentado) {
    const transactions = getBankTransactions(usuario);
    const monthlyIncome = sumTransactions(transactions, (item) => Number(item.valor ?? item.amount) > 0 || item.tipo === 'entrada');
    const monthlyExpenses = sumTransactions(transactions, (item) => Number(item.valor ?? item.amount) < 0 || item.tipo === 'saida');
    const taxPaid = sumTransactions(transactions, (item) => {
        const text = String(item.categoria || item.category || item.descricao || item.description || '').toLowerCase();
        return /imposto|das|darf|tribut|fgts|inss|icms|iss|pis|cofins/.test(text);
    });
    const bankBalance = monthlyIncome - monthlyExpenses;
    const rawRevenue = Number(usuario.faturamento || usuario.faturamentoAnual || 0);
    const annualRevenue = rawRevenue || (monthlyIncome ? Math.round(monthlyIncome * 12) : Math.round(totalMovimentado || 0));
    const rawMargin = Number(usuario.margem || usuario.margemEstimada || 0);
    const margin = rawMargin > 1 ? rawMargin / 100 : rawMargin || 0;
    const profit = Math.round(annualRevenue * margin);
    const expenses = Math.max(0, annualRevenue - profit);

    let fiscal = {
        annualTax: 0,
        monthlyTax: 0,
        taxSavings: 0,
        bestRegime: null,
        currentRegime: taxUtils.normalizeRegime(usuario.regime || ''),
        cached: false
    };

    if (annualRevenue > 0 && margin >= 0) {
        try {
            const { simulation, cached } = getFiscalSimulation({
                annualRevenue,
                margin,
                activity: taxUtils.normalizeActivity(usuario.setor || 'comercio')
            });
            const best = simulation.bestRegime || simulation.regimes?.[0] || null;
            const currentKey = taxUtils.normalizeRegime(usuario.regime || '');
            const current = currentKey ? simulation.regimes.find((item) => item.key === currentKey) : null;
            const taxSavings = current && current.eligible !== false
                ? Math.max(0, Number(current.annualTax || 0) - Number(best?.annualTax || 0))
                : Math.max(0, Number(simulation.savingsComparedToWorst?.annual || 0));

            fiscal = {
                annualTax: Math.round(Number(best?.annualTax || best?.tax || 0)),
                monthlyTax: Math.round(Number(best?.monthlyTax || best?.monthly || 0)),
                taxSavings: Math.round(taxSavings),
                bestRegime: best,
                currentRegime: currentKey,
                cached
            };
        } catch (error) {
            fiscal.error = error.message;
        }
    }

    return {
        annualRevenue,
        margin,
        profit,
        expenses,
        monthlyIncome,
        monthlyExpenses,
        bankBalance,
        taxPaid,
        connectedBanks: (usuario.connectedBanks || []).length,
        reportsCount: reports.length,
        pendingItems: reports.filter((report) => !isReportDone(report)).length,
        fiscal
    };
}

function montarDashboard(usuario) {
    const safeUser = {
        email: usuario.email,
        cnpj: usuario.cnpj || '',
        createdAt: usuario.createdAt,
        lastLogin: usuario.lastLogin || usuario.createdAt,
        fantasia: usuario.fantasia || usuario.nome || '',
        nome: usuario.nome || '',
        regime: usuario.regime || '',
        setor: usuario.setor || '',
        faturamento: usuario.faturamento || usuario.faturamentoAnual || null,
        margem: usuario.margem || usuario.margemEstimada || null,
        plano: usuario.plano || null,
        statusPagamento: usuario.statusPagamento || null,
        planAtivadoEm: usuario.planAtivadoEm || null
    };

    const reports = usuario.bankReports && usuario.bankReports.length ? usuario.bankReports : gerarRelatorioBancario(usuario.email);
    usuario.bankReports = reports;
    salvarUsuario(usuario);

    const totalMovimentado = reports.reduce((sum, item) => sum + item.amount, 0);
    const metrics = buildDashboardMetrics(usuario, reports, totalMovimentado);
    return {
        user: safeUser,
        summary: {
            reportsCount: reports.length,
            totalMovimentado,
            pendencias: metrics.pendingItems
        },
        metrics,
        reports
    };
}

async function sendCode(req, res) {
    const { email } = req.body;
    if (!validarEmail(email)) {
        return res.status(400).json({ erro: 'E-mail inválido.' });
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
        console.error('Falha ao enviar e-mail:', err.message);
    }

    const semSmtp = !process.env.MAIL_HOST && !process.env.GMAIL_USER;
    const isDev = process.env.NODE_ENV !== 'production';
    const resBody = { sucesso: true, mensagem: `Código enviado para ${emailNorm}.` };
    if (isDev && semSmtp) {
        resBody._devCode = codigo;
        resBody.mensagem = `[DEV] Código gerado sem SMTP configurado: ${codigo}`;
        console.log(`Código OTP para ${emailNorm}: ${codigo}`);
    }

    return res.json(resBody);
}

async function verifyCode(req, res) {
    const { email, code } = req.body;
    if (!validarEmail(email) || !code || String(code).trim().length === 0) {
        return res.status(400).json({ erro: 'E-mail e código são obrigatórios.' });
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

    if (!JWT_SECRET) return res.status(500).json({ erro: 'Configuração do servidor incompleta: JWT_SECRET não configurado.' });
    const token = jwt.sign({ email: usuario.email, provider: 'email' }, JWT_SECRET, { expiresIn: '7d' });
    const dashboard = montarDashboard(usuario);

    return res.json({ sucesso: true, token, dashboard });
}

async function loginCnpj(req, res) {
    const { cnpj, password } = req.body || {};
    if (!cnpj || !password) {
        return res.status(400).json({ erro: 'CNPJ e senha são obrigatórios.' });
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

    if (!JWT_SECRET) return res.status(500).json({ erro: 'Configuração do servidor incompleta: JWT_SECRET não configurado.' });
    const token = jwt.sign({ email: usuario.email, provider: 'cnpj' }, JWT_SECRET, { expiresIn: '7d' });
    const dashboard = montarDashboard(usuario);
    return res.json({ sucesso: true, token, email: usuario.email, dashboard });
}

async function registerCnpj(req, res) {
    const { cnpj, password, plan, empresa } = req.body || {};
    if (!cnpj || !password || password.length < 6) {
        return res.status(400).json({ erro: 'CNPJ e senha de no mínimo 6 caracteres são obrigatórios.' });
    }

    const cnpjNorm = String(cnpj).replace(/\D/g, '');
    if (cnpjNorm.length !== 14) {
        return res.status(400).json({ erro: 'CNPJ inválido. Informe os 14 dígitos.' });
    }

    const planNorm = plan ? String(plan).trim().toLowerCase() : 'starter';
    if (!PLANOS_PERMITIDOS.includes(planNorm)) {
        return res.status(400).json({ erro: 'Plano inválido.' });
    }

    const emailSistema = `cnpj-${cnpjNorm}@finpj.local`;

    const [existentePorCnpj, existentePorEmail] = await Promise.all([
        obterUsuarioPorCnpj(cnpjNorm),
        obterUsuario(emailSistema)
    ]);

    if (existentePorCnpj || existentePorEmail) {
        return res.status(400).json({ erro: 'CNPJ já cadastrado no sistema. Por favor, faça login.' });
    }

    const empresaData = empresa && typeof empresa === 'object' ? empresa : {};
    const usuario = {
        cnpj: cnpjNorm,
        passwordHash: await bcrypt.hash(password, 10),
        email: emailSistema,
        nome: empresaData.razao_social || empresaData.nome || empresaData.nomeEmpresa || '',
        fantasia: empresaData.nome_fantasia || empresaData.fantasia || '',
        setor: empresaData.cnae_fiscal_descricao || empresaData.atividade_principal || empresaData.setor || '',
        situacaoCadastral: empresaData.descricao_situacao_cadastral || empresaData.situacao || '',
        dadosCnpj: empresaData,
        plano: planNorm,
        statusPagamento: 'pendente',
        createdAt: new Date().toISOString(),
        bankReports: gerarRelatorioBancario(emailSistema)
    };

    await salvarUsuario(usuario);
    return res.json({ sucesso: true, mensagem: 'Conta criada com sucesso. Agora faça login com seu CNPJ.' });
}

async function getDashboard(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) {
        return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    return res.json({ sucesso: true, dashboard: montarDashboard(usuario) });
}

async function getSession(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) {
        return res.status(404).json({ erro: 'Usuario nao encontrado.' });
    }

    return res.json({
        sucesso: true,
        session: {
            email: usuario.email,
            provider: req.auth?.provider || 'local',
            expiresAt: req.auth?.exp ? new Date(req.auth.exp * 1000).toISOString() : null
        }
    });
}

module.exports = {
    sendCode,
    verifyCode,
    loginCnpj,
    registerCnpj,
    getDashboard,
    getSession,
    montarDashboard
};
