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

// Configuracao do multer para upload
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
            cb(new Error('Formato nao suportado. Use PDF, Excel, CSV ou TXT.'));
        }
    }
});

// Rate limiter for sensitive endpoints (OTP/email)
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas solicitacoes. Tente novamente mais tarde.' }
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
router.post('/diagnosticos', taxController.postDiagnostico);
router.get('/diagnosticos', verificarTokenMiddleware, async (req, res) => {
    try {
        const { obterDiagnosticos } = require('../services/database');
        const diagnosticos = await obterDiagnosticos(req.userEmail);
        res.json(diagnosticos);
    } catch (erro) {
        console.error('Erro ao obter diagnosticos:', erro);
        res.status(500).json({ erro: 'Erro ao obter diagnosticos' });
    }
});
router.get('/diagnosticos/:id', verificarTokenMiddleware, async (req, res) => {
    try {
        const { obterDiagnostico } = require('../services/database');
        const diag = await obterDiagnostico(req.params.id, req.userEmail);
        if (!diag) return res.status(404).json({ erro: 'Nao encontrado' });
        res.json(diag);
    } catch (erro) {
        console.error('Erro ao obter diagnostico:', erro);
        res.status(500).json({ erro: 'Erro ao obter diagnostico' });
    }
});
router.delete('/diagnosticos/:id', verificarTokenMiddleware, async (req, res) => {
    try {
        const { deletarDiagnostico } = require('../services/database');
        const deletado = await deletarDiagnostico(req.params.id, req.userEmail);
        if (!deletado) return res.status(404).json({ erro: 'Nao encontrado' });
        res.json({ sucesso: true });
    } catch (erro) {
        console.error('Erro ao deletar diagnostico:', erro);
        res.status(500).json({ erro: 'Erro ao deletar diagnostico' });
    }
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
router.post('/pagamento', verificarTokenMiddleware, paymentController.processarPagamento);
router.post('/stripe/create-checkout-session', verificarTokenMiddleware, paymentController.createCheckoutSession);
router.post('/webhooks/stripe', paymentController.webhookStripe);

// Health check
router.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

module.exports = router;
