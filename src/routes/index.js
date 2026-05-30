const express = require('express');
const multer = require('multer');
const { obterUsuario, obterDiagnosticos, obterDiagnostico, deletarDiagnostico, conectarDB } = require('../services/database');
const { getScopedCompanyRecord, filterRecordsByCompany, recordMatchesCompany } = require('../services/companyContext');
const pluggyService = require('../services/pluggyService');
const { verificarEEnviarAlertas } = require('../services/alertService');

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
            cb(new Error('Formato não suportado. Use PDF, Excel, CSV, TXT ou imagem (JPG/PNG).'));
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
        if (!diag) return res.status(404).json({ erro: 'Não encontrado.' });
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
        if (!diag) return res.status(404).json({ erro: 'Não encontrado.' });
        const scoped = usuario ? getScopedCompanyRecord(usuario, req.query?.companyId) : null;
        if (scoped && !recordMatchesCompany(diag, scoped, { includeUnscoped: scoped.isPrimary })) {
            return res.status(404).json({ erro: 'Nao encontrado.' });
        }
        const deletado = await deletarDiagnostico(req.params.id, req.userEmail);
        if (!deletado) return res.status(404).json({ erro: 'Não encontrado.' });
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

// ── Pluggy Webhook ──
router.post('/webhooks/pluggy', wrap(async (req, res) => {
    try {
        const event = req.body;
        const { eventType, itemId, action } = pluggyService.parseWebhookEvent(event);
        console.log(`[Pluggy Webhook] ${eventType} → item=${itemId} action=${action}`);

        if (action === 'sync' && itemId) {
            // Find the user who has this bank connected and sync transactions
            const db = await conectarDB();
            const usuario = await db.collection('usuarios').findOne({
                'connectedBanks.bankId': itemId
            });

            if (usuario) {
                const bank = (usuario.connectedBanks || []).find(b => b.bankId === itemId);
                if (bank) {
                    const { transactions } = await pluggyService.fetchFullItemData(itemId);
                    if (transactions.length > 0) {
                        await db.collection('usuarios').updateOne(
                            { email: usuario.email, 'connectedBanks.bankId': itemId },
                            {
                                $set: {
                                    'connectedBanks.$.transactions': transactions,
                                    'connectedBanks.$.lastSync': new Date().toISOString(),
                                    'connectedBanks.$.dataSource': 'pluggy',
                                    updatedAt: new Date()
                                }
                            }
                        );
                        console.log(`[Pluggy Webhook] Synced ${transactions.length} transactions for ${usuario.email}`);

                        // Check alerts after sync
                        try {
                            await verificarEEnviarAlertas(usuario);
                        } catch (alertErr) {
                            console.warn('[Pluggy Webhook] Alert check failed:', alertErr.message);
                        }
                    }
                }
            }
        } else if (action === 'mark_error' && itemId) {
            const db = await conectarDB();
            await db.collection('usuarios').updateMany(
                { 'connectedBanks.bankId': itemId },
                {
                    $set: {
                        'connectedBanks.$.status': 'error',
                        'connectedBanks.$.lastError': eventType,
                        updatedAt: new Date()
                    }
                }
            );
        }

        return res.json({ received: true, action });
    } catch (e) {
        console.error('[Pluggy Webhook] Error:', e.message);
        return res.json({ received: true, error: e.message });
    }
}));

// ── OCR Pipeline (process document from R2 or direct upload) ──
router.post('/ocr/process', verificarTokenMiddleware, upload.single('arquivo'), wrap(async (req, res) => {
    const { key, tipo = 'dre', contexto = '' } = req.body;
    const { isStorageConfigured, uploadBuffer, downloadBuffer, deleteObject, sanitizeFilename } = require('../services/storageService');
    const { analisarComGroq } = require('../services/aiService');
    const { salvarAnalise } = require('../services/database');

    let buffer;
    let filename;
    let contentType;
    let r2Key = key;

    if (req.file) {
        // Direct upload: save to R2 first, then process
        buffer = req.file.buffer;
        filename = req.file.originalname;
        contentType = req.file.mimetype;

        if (isStorageConfigured()) {
            const safeName = sanitizeFilename(filename);
            r2Key = `ocr/${Date.now()}-${req.userEmail.replace(/[^a-zA-Z0-9]/g, '_')}-${safeName}`;
            try {
                await uploadBuffer(buffer, r2Key, contentType, { email: req.userEmail, tipo });
                console.log(`[OCR] Uploaded to R2: ${r2Key} (${buffer.length} bytes)`);
            } catch (uploadErr) {
                console.warn('[OCR] R2 upload failed, processing in-memory:', uploadErr.message);
            }
        }
    } else if (key && isStorageConfigured()) {
        // Process from R2 key
        try {
            const download = await downloadBuffer(key);
            buffer = download.buffer;
            contentType = download.contentType;
            filename = key.split('/').pop();
        } catch (dlErr) {
            return res.status(404).json({ erro: 'Documento não encontrado no R2.', detalhes: dlErr.message });
        }
    } else {
        return res.status(400).json({ erro: 'Envie um arquivo ou forneça a key do R2.' });
    }

    // Extract text
    let texto = '';
    const nome = (filename || '').toLowerCase();
    const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
    const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'];
    const isImage = IMAGE_MIMES.includes(contentType) || IMAGE_EXTS.some(ext => nome.endsWith(ext));

    try {
        if (isImage) {
            const { createWorker } = require('tesseract.js');
            const worker = await createWorker('por');
            try {
                const ret = await worker.recognize(buffer);
                texto = ret.data.text || '';
            } finally {
                await worker.terminate();
            }
        } else if (contentType === 'application/pdf' || nome.endsWith('.pdf')) {
            const pdfParse = require('pdf-parse');
            const data = typeof pdfParse === 'function' ? await pdfParse(buffer) : await pdfParse.default(buffer);
            texto = data.text || '';
        } else if (nome.match(/\.(xlsx|xls|ods)$/)) {
            const ExcelJS = require('exceljs');
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            workbook.eachSheet((ws) => {
                texto += `=== ${ws.name} ===\n`;
                ws.eachRow((row) => {
                    texto += row.values.filter(v => v != null).map(String).join(',') + '\n';
                });
            });
        } else {
            texto = buffer.toString('utf-8');
        }
    } catch (parseErr) {
        return res.status(422).json({ erro: 'Falha ao extrair texto do documento.', detalhes: parseErr.message });
    }

    if (!texto.trim() || texto.trim().length < 50) {
        return res.status(422).json({
            erro: 'Texto extraído insuficiente.',
            sugestao: 'Envie o documento como imagem (JPG/PNG) ou Excel/CSV.'
        });
    }

    // Analyze with Groq
    const analise = await analisarComGroq(tipo, texto.slice(0, 100000), contexto);

    // Save analysis
    try {
        await salvarAnalise({
            email: req.userEmail,
            tipo,
            nomeArquivo: filename,
            tamanho: buffer.length,
            data: new Date().toISOString(),
            resultado: analise.dados,
            fonte: analise.fonte,
            confianca: analise.confianca,
            pipeline: 'ocr-r2',
            r2Key: r2Key || null
        });
    } catch (saveErr) {
        console.warn('[OCR] Failed to save analysis:', saveErr.message);
    }

    // Cleanup R2 temp file
    if (r2Key && r2Key !== key && isStorageConfigured()) {
        deleteObject(r2Key).catch(() => {});
    }

    return res.json({
        sucesso: true,
        ...analise,
        nomeArquivo: filename,
        pipeline: 'ocr-r2',
        tamanho: buffer.length
    });
}));

// ── Alertas ──
router.post('/alerts/check', verificarTokenMiddleware, wrap(async (req, res) => {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    const result = await verificarEEnviarAlertas(usuario, { force: req.body?.force === true });
    return res.json({ sucesso: true, ...result });
}));

router.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

module.exports = router;
