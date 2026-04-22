const express = require('express');
const router = express.Router();
const multer = require('multer');
let rateLimit;
try {
    rateLimit = require('express-rate-limit');
} catch {
    rateLimit = () => (req, res, next) => next();
}
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

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

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || Math.floor(50 * 1024 * 1024));

// Configuração do multer para upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/csv', 'text/plain',
            'image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
        if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|xlsx|xls|csv|txt|ods|jpe?g|png|webp|bmp|tiff)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('Formato não suportado. Use PDF, Excel, CSV, TXT ou imagem (JPG/PNG).'));
        }
    }
});

// Rate limiter for sensitive endpoints (OTP/email)
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas solicitações. Tente novamente mais tarde.' }
});

// ===============================
// AUTH & CNPJ ROUTES
// ===============================
router.post('/auth/send-code', otpLimiter, wrap(authController.sendCode));
router.post('/auth/verify-code', wrap(authController.verifyCode));
router.post('/auth/login-cnpj', wrap(authController.loginCnpj));
router.post('/auth/register-cnpj', wrap(authController.registerCnpj));
router.get('/auth/session', verificarTokenMiddleware, wrap(authController.getSession));
router.get('/dashboard', verificarTokenMiddleware, wrap(authController.getDashboard));
router.get('/cnpj', wrap(cnpjController.consultarCnpj));

// ===============================
// FINANCE & OPEN FINANCE ROUTES
// ===============================
router.get('/openfinance/token', verificarTokenMiddleware, wrap(financeController.getPluggyToken));
router.get('/openfinance/banks', verificarTokenMiddleware, wrap(financeController.getBanks));
router.get('/openfinance/summary', verificarTokenMiddleware, wrap(financeController.getOpenFinanceSummary));
router.get('/openfinance/transactions', verificarTokenMiddleware, wrap(financeController.getOpenFinanceTransactions));
router.post('/openfinance/connect', verificarTokenMiddleware, wrap(financeController.connectBank));
router.post('/openfinance/sync/:bankId', verificarTokenMiddleware, wrap(financeController.syncBank));
router.delete('/openfinance/banks/:bankId', verificarTokenMiddleware, wrap(financeController.removeBank));
router.post('/openfinance/transactions/:txId/tags', verificarTokenMiddleware, wrap(financeController.tagTransaction));
router.post('/conciliacao', verificarTokenMiddleware, wrap(financeController.conciliar));
router.get('/cashflow-projection', verificarTokenMiddleware, wrap(financeController.cashflowProjection));

// ===============================
// TAX & DIAGNOSTIC ROUTES
// ===============================
router.post('/calcular-das', verificarTokenMiddleware, wrap(taxController.calcularDas));
router.post('/gerar-das-automatico', verificarTokenMiddleware, wrap(taxController.gerarDasAutomatico));
router.get('/fiscal-calendar', verificarTokenMiddleware, wrap(taxController.fiscalCalendar));
router.post('/diagnosticos', verificarTokenMiddleware, wrap(taxController.postDiagnostico));
router.get('/diagnosticos', verificarTokenMiddleware, wrap(async (req, res) => {
    try {
        const { obterDiagnosticos } = require('../services/database');
        const diagnosticos = await obterDiagnosticos(req.userEmail);
        res.json(diagnosticos);
    } catch (erro) {
        console.error('Erro ao obter diagnósticos:', erro);
        res.status(500).json({ erro: 'Erro ao obter diagnósticos.' });
    }
}));
router.get('/diagnosticos/:id', verificarTokenMiddleware, wrap(async (req, res) => {
    try {
        const { obterDiagnostico } = require('../services/database');
        const diag = await obterDiagnostico(req.params.id, req.userEmail);
        if (!diag) return res.status(404).json({ erro: 'Não encontrado.' });
        res.json(diag);
    } catch (erro) {
        console.error('Erro ao obter diagnóstico:', erro);
        res.status(500).json({ erro: 'Erro ao obter diagnóstico.' });
    }
}));
router.delete('/diagnosticos/:id', verificarTokenMiddleware, wrap(async (req, res) => {
    try {
        const { deletarDiagnostico } = require('../services/database');
        const deletado = await deletarDiagnostico(req.params.id, req.userEmail);
        if (!deletado) return res.status(404).json({ erro: 'Não encontrado.' });
        res.json({ sucesso: true });
    } catch (erro) {
        console.error('Erro ao excluir diagnóstico:', erro);
        res.status(500).json({ erro: 'Erro ao excluir diagnóstico.' });
    }
}));

// ===============================
// DOCUMENTS & AI ROUTES
// ===============================
router.post('/upload-documento', verificarTokenMiddleware, upload.single('arquivo'), wrap(documentController.uploadDocumento));
router.post('/upload-url', verificarTokenMiddleware, wrap(documentController.getUploadUrl));
router.post('/process-document', verificarTokenMiddleware, wrap(documentController.processDocumentFromUrl));
router.get('/analises', verificarTokenMiddleware, wrap(documentController.getAnalises));
router.post('/chat', verificarTokenMiddleware, wrap(documentController.postChat));

// ===============================
// USER PROFILE & NOTIFICATIONS ROUTES
// ===============================
router.get('/profile', verificarTokenMiddleware, wrap(userController.getProfile));
router.put('/profile', verificarTokenMiddleware, wrap(userController.updateProfile));
router.get('/notifications', verificarTokenMiddleware, wrap(userController.getNotifications));
router.post('/notifications/read', verificarTokenMiddleware, wrap(userController.readNotifications));

// ===============================
// PAYMENTS & STRIPE ROUTES
// ===============================
router.post('/pagamento', verificarTokenMiddleware, wrap(paymentController.processarPagamento));
router.post('/stripe/create-checkout-session', verificarTokenMiddleware, wrap(paymentController.createCheckoutSession));
router.post('/webhooks/stripe', wrap(paymentController.webhookStripe));

// Health check
router.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

module.exports = router;
