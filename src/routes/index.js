const express = require('express');
const multer = require('multer');
const { obterUsuario, obterDiagnosticos, obterDiagnostico, deletarDiagnostico } = require('../services/database');
const { getScopedCompanyRecord, filterRecordsByCompany, recordMatchesCompany } = require('../services/companyContext');

const router = express.Router();

let rateLimit;
try {
    rateLimit = require('express-rate-limit');
} catch {
    rateLimit = () => (req, res, next) => next();
}

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const { verificarTokenMiddleware } = require('../middlewares/auth');
const { 
    validateRequest, 
    validateRegisterCNPJ, 
    validateLoginCNPJ, 
    validateEmailCode,
    validateDiagnostic,
    validateProfile,
    validateAIAnalysis,
    validateChatMessage
} = require('../middlewares/validation');

const authController = require('../controllers/authController');
const accountAuthController = require('../controllers/accountAuthController');
const cnpjController = require('../controllers/cnpjController');
const financeController = require('../controllers/financeController');
const taxController = require('../controllers/taxController');
const documentController = require('../controllers/documentController');
const userController = require('../controllers/userController');
const paymentController = require('../controllers/paymentController');
const companyController = require('../controllers/companyController');

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || Math.floor(50 * 1024 * 1024));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter: (req, file, cb) => {
        const allowed = [
            'application/pdf',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/csv',
            'text/plain',
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/bmp',
            'image/tiff'
        ];
        if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|xlsx|xls|csv|txt|ods|jpe?g|png|webp|bmp|tiff)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('Formato nao suportado. Use PDF, Excel, CSV, TXT ou imagem (JPG/PNG).'));
        }
    }
});

const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas solicitacoes. Tente novamente mais tarde.' }
});

const authWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas tentativas de autenticação. Aguarde um pouco e tente novamente.' }
});

const passwordRecoveryLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas solicitações para recuperação de senha. Tente novamente mais tarde.' }
});

router.post('/auth/register', authWriteLimiter, wrap(accountAuthController.register));
router.post('/auth/login', authWriteLimiter, wrap(accountAuthController.login));
router.post('/auth/verify-email', authWriteLimiter, wrap(accountAuthController.verifyEmail));
router.post('/auth/resend-verification', authWriteLimiter, wrap(accountAuthController.resendVerification));
router.post('/auth/forgot-password', passwordRecoveryLimiter, wrap(accountAuthController.forgotPassword));
router.post('/auth/reset-password', passwordRecoveryLimiter, wrap(accountAuthController.resetPassword));
router.post('/auth/send-code', otpLimiter, wrap(authController.sendCode));
router.post('/auth/verify-code', wrap(authController.verifyCode));
router.post('/auth/login-cnpj', validateRequest(validateLoginCNPJ), wrap(authController.loginCnpj));
router.post('/auth/register-cnpj', validateRequest(validateRegisterCNPJ), wrap(authController.registerCnpj));
router.post('/auth/logout', verificarTokenMiddleware, wrap(accountAuthController.logout));
router.get('/auth/session', verificarTokenMiddleware, wrap(accountAuthController.getSession));
router.get('/auth/oauth/:provider/start', wrap(accountAuthController.startOAuth));
router.get('/auth/oauth/:provider/callback', wrap(accountAuthController.oauthCallback));
router.get('/onboarding/state', verificarTokenMiddleware, wrap(accountAuthController.getOnboardingState));
router.put('/onboarding/state', verificarTokenMiddleware, wrap(accountAuthController.saveOnboardingState));
router.post('/onboarding/complete-step', verificarTokenMiddleware, wrap(accountAuthController.completeOnboardingStep));
router.get('/dashboard', verificarTokenMiddleware, wrap(authController.getDashboard));
router.get('/cnpj', wrap(cnpjController.consultarCnpj));

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

router.post('/calcular-das', verificarTokenMiddleware, wrap(taxController.calcularDas));
router.post('/gerar-das-automatico', verificarTokenMiddleware, wrap(taxController.gerarDasAutomatico));
router.get('/fiscal-calendar', verificarTokenMiddleware, wrap(taxController.fiscalCalendar));
router.post('/diagnosticos', verificarTokenMiddleware, validateRequest(validateDiagnostic), wrap(taxController.postDiagnostico));
router.get('/diagnosticos', verificarTokenMiddleware, wrap(async (req, res) => {
    try {
        const [usuario, diagnosticos] = await Promise.all([
            obterUsuario(req.userEmail),
            obterDiagnosticos(req.userEmail)
        ]);
        const scoped = usuario ? getScopedCompanyRecord(usuario, req.query?.companyId) : null;
        return res.json(scoped ? filterRecordsByCompany(diagnosticos, scoped) : diagnosticos);
    } catch (erro) {
        console.error('Erro ao obter diagnosticos:', erro);
        return res.status(500).json({ erro: 'Erro ao obter diagnosticos.' });
    }
}));
router.get('/diagnosticos/:id', verificarTokenMiddleware, wrap(async (req, res) => {
    try {
        const [usuario, diag] = await Promise.all([
            obterUsuario(req.userEmail),
            obterDiagnostico(req.params.id, req.userEmail)
        ]);
        if (!diag) return res.status(404).json({ erro: 'Nao encontrado.' });
        const scoped = usuario ? getScopedCompanyRecord(usuario, req.query?.companyId) : null;
        if (scoped && !recordMatchesCompany(diag, scoped, { includeUnscoped: scoped.isPrimary })) {
            return res.status(404).json({ erro: 'Nao encontrado.' });
        }
        return res.json(diag);
    } catch (erro) {
        console.error('Erro ao obter diagnostico:', erro);
        return res.status(500).json({ erro: 'Erro ao obter diagnostico.' });
    }
}));
router.delete('/diagnosticos/:id', verificarTokenMiddleware, wrap(async (req, res) => {
    try {
        const [usuario, diag] = await Promise.all([
            obterUsuario(req.userEmail),
            obterDiagnostico(req.params.id, req.userEmail)
        ]);
        if (!diag) return res.status(404).json({ erro: 'Nao encontrado.' });
        const scoped = usuario ? getScopedCompanyRecord(usuario, req.query?.companyId) : null;
        if (scoped && !recordMatchesCompany(diag, scoped, { includeUnscoped: scoped.isPrimary })) {
            return res.status(404).json({ erro: 'Nao encontrado.' });
        }
        const deletado = await deletarDiagnostico(req.params.id, req.userEmail);
        if (!deletado) return res.status(404).json({ erro: 'Nao encontrado.' });
        return res.json({ sucesso: true });
    } catch (erro) {
        console.error('Erro ao excluir diagnostico:', erro);
        return res.status(500).json({ erro: 'Erro ao excluir diagnostico.' });
    }
}));

router.post('/upload-documento', verificarTokenMiddleware, validateRequest(validateAIAnalysis), upload.single('arquivo'), wrap(documentController.uploadDocumento));
router.post('/upload-url', verificarTokenMiddleware, wrap(documentController.getUploadUrl));
router.post('/process-document', verificarTokenMiddleware, wrap(documentController.processDocumentFromUrl));
router.get('/analises', verificarTokenMiddleware, wrap(documentController.getAnalises));
router.post('/chat', verificarTokenMiddleware, validateRequest(validateChatMessage), wrap(documentController.postChat));

router.get('/profile', verificarTokenMiddleware, wrap(userController.getProfile));
router.put('/profile', verificarTokenMiddleware, wrap(userController.updateProfile));
router.get('/notifications', verificarTokenMiddleware, wrap(userController.getNotifications));
router.post('/notifications/read', verificarTokenMiddleware, wrap(userController.readNotifications));

router.get('/companies', verificarTokenMiddleware, wrap(companyController.getCompanies));
router.post('/companies', verificarTokenMiddleware, wrap(companyController.createCompany));
router.put('/companies/:companyId', verificarTokenMiddleware, wrap(companyController.updateCompany));

router.post('/pagamento', verificarTokenMiddleware, wrap(paymentController.processarPagamento));
router.post('/stripe/create-checkout-session', verificarTokenMiddleware, wrap(paymentController.createCheckoutSession));
router.post('/webhooks/stripe', wrap(paymentController.webhookStripe));

router.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

module.exports = router;
