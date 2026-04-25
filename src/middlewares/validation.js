const { body, validationResult } = require('express-validator');

// Validation middleware factory
function validateRequest(validations) {
    return async (req, res, next) => {
        await Promise.all(validations.map(validation => validation.run(req)));
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                erro: 'Dados inválidos na requisição.',
                detalhes: errors.array().map(err => ({
                    campo: err.path,
                    mensagem: err.msg
                }))
            });
        }
        
        next();
    };
}

// Common validation rules
const validateEmail = body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('E-mail inválido.');

const validatePassword = body('password')
    .isLength({ min: 8 })
    .withMessage('Senha deve ter no mínimo 8 caracteres.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Senha deve conter letras maiúsculas, minúsculas e números.');

const validateCNPJ = body('cnpj')
    .isLength({ min: 14, max: 14 })
    .isNumeric()
    .withMessage('CNPJ deve conter exatamente 14 dígitos.');

const validateNome = body('nome')
    .optional()
    .isLength({ max: 200 })
    .trim()
    .escape()
    .withMessage('Nome deve ter no máximo 200 caracteres.');

const validateFaturamento = body('faturamento')
    .optional()
    .isFloat({ min: 0, max: 10000000000 })
    .withMessage('Faturamento deve ser um número positivo válido.');

const validateMargem = body('margem')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Margem deve estar entre 0 e 1 (0% a 100%).');

// Specific validation chains
const validateRegisterCNPJ = [
    validateCNPJ,
    validatePassword,
    validateNome,
    validateFaturamento,
    validateMargem,
    body('plan')
        .optional()
        .isIn(['starter', 'growth', 'enterprise'])
        .withMessage('Plano inválido.')
];

const validateLoginCNPJ = [
    validateCNPJ,
    body('password').notEmpty().withMessage('Senha é obrigatória.')
];

const validateEmailCode = [
    validateEmail,
    body('code')
        .isLength({ min: 6, max: 6 })
        .isNumeric()
        .withMessage('Código deve ter exatamente 6 dígitos.')
];

const validateDiagnostic = [
    validateNome,
    validateCNPJ,
    body('setor')
        .optional()
        .isLength({ max: 100 })
        .trim()
        .escape()
        .withMessage('Setor deve ter no máximo 100 caracteres.'),
    body('regime')
        .optional()
        .isIn(['simples', 'presumido', 'real'])
        .withMessage('Regime tributário inválido.'),
    validateFaturamento,
    validateMargem
];

const validateProfile = [
    validateNome,
    body('fantasia')
        .optional()
        .isLength({ max: 200 })
        .trim()
        .escape()
        .withMessage('Nome fantasia deve ter no máximo 200 caracteres.'),
    validateCNPJ,
    body('telefone')
        .optional()
        .isMobilePhone('pt-BR')
        .withMessage('Telefone inválido.'),
    body('regime')
        .optional()
        .isIn(['simples', 'presumido', 'real'])
        .withMessage('Regime tributário inválido.'),
    body('setor')
        .optional()
        .isLength({ max: 100 })
        .trim()
        .escape()
        .withMessage('Setor deve ter no máximo 100 caracteres.'),
    validateFaturamento,
    validateMargem
];

const validateAIAnalysis = [
    body('tipo')
        .isIn(['dre', 'balanco', 'extrato'])
        .withMessage('Tipo de documento inválido.'),
    body('contexto')
        .optional()
        .isLength({ max: 1000 })
        .trim()
        .escape()
        .withMessage('Contexto deve ter no máximo 1000 caracteres.')
];

const validateChatMessage = [
    body('message')
        .isLength({ min: 1, max: 1000 })
        .trim()
        .escape()
        .withMessage('Mensagem deve ter entre 1 e 1000 caracteres.'),
    body('context')
        .optional()
        .isLength({ max: 1000 })
        .trim()
        .escape()
        .withMessage('Contexto deve ter no máximo 1000 caracteres.')
];

module.exports = {
    validateRequest,
    validateRegisterCNPJ,
    validateLoginCNPJ,
    validateEmailCode,
    validateDiagnostic,
    validateProfile,
    validateAIAnalysis,
    validateChatMessage,
    validateEmail,
    validatePassword,
    validateCNPJ,
    validateNome,
    validateFaturamento,
    validateMargem
};
