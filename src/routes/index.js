const express = require('express');
const router = express.Router();
const multer = require('multer');
const rateLimit = require('express-rate-limit');

// Middlewares
const { verificarTokenMiddleware } = require('../middlewares/auth');

// Controllers
const authController = require('../controllers/authController');
const cnpjController = require('../controllers/cnpjController');
const financeController = require('../controllers/financeController');
const taxController = require('../controllers/taxController');
const documentController = require('../controllers/documentController');
const userController = require('../controllers/userController');
const paymentController = require('../controllers/paymentController');

// Configuração do multer para upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
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

// Rate limiter for sensitive endpoints (OTP/email)
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas solicitações. Tente novamente mais tarde.' }
});

// ===============================
// AUTH & CNPJ ROUTES
// ===============================
router.post('/auth/send-code', otpLimiter, authController.sendCode);
router.post('/auth/verify-code', authController.verifyCode);
router.post('/auth/login-cnpj', authController.loginCnpj);
router.post('/auth/register-cnpj', authController.registerCnpj);
router.get('/dashboard', verificarTokenMiddleware, authController.getDashboard);
router.get('/cnpj', cnpjController.consultarCnpj);

// ===============================
// FINANCE & OPEN FINANCE ROUTES
// ===============================
router.get('/openfinance/token', verificarTokenMiddleware, financeController.getPluggyToken);
router.get('/openfinance/banks', verificarTokenMiddleware, financeController.getBanks);
router.post('/openfinance/connect', verificarTokenMiddleware, financeController.connectBank);
router.post('/openfinance/sync/:bankId', verificarTokenMiddleware, financeController.syncBank);
router.delete('/openfinance/banks/:bankId', verificarTokenMiddleware, financeController.removeBank);
router.post('/openfinance/transactions/:txId/tags', verificarTokenMiddleware, financeController.tagTransaction);
router.post('/conciliacao', verificarTokenMiddleware, financeController.conciliar);
router.get('/cashflow-projection', verificarTokenMiddleware, financeController.cashflowProjection);

// ===============================
// TAX & DIAGNOSTIC ROUTES
// ===============================
router.post('/calcular-das', verificarTokenMiddleware, taxController.calcularDas);
router.post('/gerar-das-automatico', verificarTokenMiddleware, taxController.gerarDasAutomatico);
router.get('/fiscal-calendar', verificarTokenMiddleware, taxController.fiscalCalendar);
router.post('/diagnosticos', taxController.postDiagnostico); // Sem auth no landing
router.get('/diagnosticos', (req, res) => {
    const { lerDados } = require('../services/database');
    res.json(lerDados().diagnosticos);
});
router.get('/diagnosticos/:id', (req, res) => {
    const { lerDados } = require('../services/database');
    const d = lerDados().diagnosticos.find(d => d.id == req.params.id);
    if (!d) return res.status(404).json({ erro: 'Não encontrado' });
    res.json(d);
});
router.delete('/diagnosticos/:id', (req, res) => {
    const { lerDados, salvarDados } = require('../services/database');
    const dados = lerDados();
    dados.diagnosticos = dados.diagnosticos.filter(d => d.id != req.params.id);
    salvarDados(dados);
    res.json({ sucesso: true });
});

// ===============================
// DOCUMENTS & AI ROUTES
// ===============================
router.post('/upload-documento', verificarTokenMiddleware, upload.single('arquivo'), documentController.uploadDocumento);
router.get('/analises', verificarTokenMiddleware, documentController.getAnalises);
router.post('/chat', verificarTokenMiddleware, documentController.postChat);

// ===============================
// USER PROFILE & NOTIFICATIONS ROUTES
// ===============================
router.get('/profile', verificarTokenMiddleware, userController.getProfile);
router.put('/profile', verificarTokenMiddleware, userController.updateProfile);
router.get('/notifications', verificarTokenMiddleware, userController.getNotifications);
router.post('/notifications/read', verificarTokenMiddleware, userController.readNotifications);

// ===============================
// PAYMENTS & STRIPE ROUTES
// ===============================
router.post('/pagamento', paymentController.processarPagamento);
router.post('/stripe/create-checkout-session', paymentController.createCheckoutSession);
router.post('/webhooks/stripe', express.raw({type: 'application/json'}), paymentController.webhookStripe);

// Health check
router.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

module.exports = router;
