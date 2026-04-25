const {
    SESSION_TTL_MS,
    EMAIL_VERIFICATION_TTL_MS,
    PASSWORD_RESET_TTL_MS,
    EMAIL_RESEND_COOLDOWN_MS,
    normalizeEmail,
    validateEmail,
    validatePassword,
    hashPassword,
    comparePassword,
    createScopedOpaqueToken,
    parseScopedOpaqueToken,
    issueSessionToken,
    isFutureDate,
    isCooldownActive,
    publicAuthUser
} = require('../services/authTokens');
const {
    findAuthUserByEmail,
    findAuthUserById,
    createAuthUser,
    updateAuthAndLegacyUser,
    createSession,
    findSessionById,
    revokeSession,
    revokeUserSessions,
    ensureOnboardingState,
    getOnboardingState,
    saveOnboardingState,
    completeOnboardingStep,
    syncLegacyUserRecord
} = require('../services/authStore');
const { normalizeStep } = require('../services/onboardingService');
const {
    emailTransportConfigured,
    enviarEmailVerificacaoCadastro,
    enviarEmailRecuperacaoSenha
} = require('../services/emailService');
const {
    resolveBaseUrl,
    buildOAuthStartUrl,
    exchangeOAuthCode,
    fetchOAuthProfile,
    parseOAuthState
} = require('../services/oauthService');

function nowIso() {
    return new Date().toISOString();
}

function verificationExpiry() {
    return new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS).toISOString();
}

function passwordResetExpiry() {
    return new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();
}

function sessionExpiry() {
    return new Date(Date.now() + SESSION_TTL_MS).toISOString();
}

function resendRetrySeconds(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 0;
    return Math.max(0, Math.ceil((date.getTime() + EMAIL_RESEND_COOLDOWN_MS - Date.now()) / 1000));
}

function clientPathForStep(step) {
    const routes = {
        'verify-email': '/onboarding/verificar-email',
        profile: '/onboarding/perfil',
        plan: '/onboarding/plano',
        template: '/onboarding/template',
        checklist: '/onboarding/checklist',
        'first-value': '/onboarding/primeiro-valor',
        dashboard: '/dashboard'
    };
    return routes[step] || '/dashboard';
}

function requestMetadata(req) {
    return {
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
        userAgent: req.headers['user-agent'] || ''
    };
}

function buildEmailVerificationUrl(token, email) {
    const url = new URL('/onboarding/verificar-email', resolveBaseUrl());
    url.searchParams.set('token', token);
    url.searchParams.set('email', normalizeEmail(email));
    return url.toString();
}

function buildPasswordResetUrl(token, email) {
    const url = new URL('/reset-password', resolveBaseUrl());
    url.searchParams.set('token', token);
    url.searchParams.set('email', normalizeEmail(email));
    return url.toString();
}

function responseTokenPreview(rawToken) {
    if (process.env.NODE_ENV === 'production' || emailTransportConfigured()) return {};
    return { _devToken: rawToken };
}

async function issueAuthenticatedResponse({ req, res, user, provider, message, status = 200, redirectTo }) {
    const onboarding = await ensureOnboardingState(user);
    const session = await createSession({
        user,
        provider,
        ...requestMetadata(req),
        expiresAt: sessionExpiry()
    });
    const finalToken = issueSessionToken({
        userId: user.id,
        sessionId: session.id,
        email: user.email,
        provider
    });

    return res.status(status).json({
        sucesso: true,
        mensagem: message,
        token: finalToken.token,
        user: publicAuthUser(user, onboarding),
        onboarding,
        session: {
            id: session.id,
            provider,
            expiresAt: finalToken.expiresAt
        },
        redirectTo: redirectTo || clientPathForStep(onboarding.currentStep)
    });
}

async function sendVerificationLink(user) {
    const scopedToken = createScopedOpaqueToken(user.id);
    const expiresAt = verificationExpiry();
    const emailVerification = {
        tokenHash: scopedToken.tokenHash,
        expiresAt,
        sentAt: nowIso()
    };
    const nextUser = await updateAuthAndLegacyUser(user.id, { emailVerification });
    const verificationUrl = buildEmailVerificationUrl(scopedToken.token, nextUser.email);
    await enviarEmailVerificacaoCadastro(nextUser.email, verificationUrl);
    return {
        user: nextUser,
        verificationUrl,
        token: scopedToken.token
    };
}

async function sendPasswordResetLink(user) {
    const scopedToken = createScopedOpaqueToken(user.id);
    const passwordReset = {
        tokenHash: scopedToken.tokenHash,
        expiresAt: passwordResetExpiry(),
        sentAt: nowIso()
    };
    const nextUser = await updateAuthAndLegacyUser(user.id, { passwordReset });
    const resetUrl = buildPasswordResetUrl(scopedToken.token, nextUser.email);
    await enviarEmailRecuperacaoSenha(nextUser.email, resetUrl);
    return {
        user: nextUser,
        resetUrl,
        token: scopedToken.token
    };
}

async function register(req, res) {
    const { email, password, name, usageType, avatarUrl, plan, templateKey } = req.body || {};
    if (!validateEmail(email)) {
        return res.status(400).json({ erro: 'Informe um e-mail válido.' });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        return res.status(400).json({ erro: passwordValidation.message, code: passwordValidation.code });
    }

    const normalizedEmail = normalizeEmail(email);
    const existing = await findAuthUserByEmail(normalizedEmail);
    if (existing?.emailVerifiedAt) {
        return res.status(409).json({ erro: 'Já existe uma conta ativa com este e-mail. Faça login para continuar.' });
    }

    const passwordHash = await hashPassword(password);
    let user;
    if (existing) {
        user = await updateAuthAndLegacyUser(existing.id, {
            passwordHash,
            profile: {
                name: name || existing.profile?.name || '',
                usageType: usageType || existing.profile?.usageType || '',
                avatarUrl: avatarUrl || existing.profile?.avatarUrl || ''
            },
            plan: plan || existing.plan || 'freemium',
            templateKey: templateKey || existing.templateKey || ''
        });
    } else {
        user = await createAuthUser({
            email: normalizedEmail,
            passwordHash,
            providers: {
                password: {
                    enabledAt: nowIso()
                }
            },
            profile: {
                name: name || '',
                usageType: usageType || '',
                avatarUrl: avatarUrl || ''
            },
            plan: plan || 'freemium',
            templateKey: templateKey || ''
        });
        await syncLegacyUserRecord(user);
    }

    let onboarding = await ensureOnboardingState(user);
    if (name || usageType || avatarUrl) {
        onboarding = await saveOnboardingState(user.id, {
            step: 'profile',
            data: { name: name || '', usageType: usageType || '', avatarUrl: avatarUrl || '' }
        });
    }
    if (plan) {
        onboarding = await saveOnboardingState(user.id, {
            step: 'plan',
            data: { plan }
        });
    }
    if (templateKey) {
        onboarding = await saveOnboardingState(user.id, {
            step: 'template',
            data: { templateKey }
        });
    }

    const verification = await sendVerificationLink(user);
    onboarding = await ensureOnboardingState(verification.user);

    return res.status(existing ? 200 : 201).json({
        sucesso: true,
        mensagem: 'Conta criada. Verifique seu e-mail para continuar.',
        verificationRequired: true,
        nextStep: 'verify-email',
        redirectTo: clientPathForStep(onboarding.currentStep),
        user: publicAuthUser(verification.user, onboarding),
        onboarding,
        ...responseTokenPreview(verification.token)
    });
}

async function login(req, res) {
    const provider = String(req.body?.provider || 'password').trim().toLowerCase();
    if (provider === 'google' || provider === 'github') {
        try {
            const oauth = buildOAuthStartUrl(provider, {
                mode: 'login',
                returnTo: req.body?.returnTo || '/dashboard'
            });
            return res.json({
                sucesso: true,
                provider,
                redirectUrl: oauth.url
            });
        } catch (error) {
            return res.status(503).json({ erro: error.message || 'OAuth temporariamente indisponível.' });
        }
    }

    if (provider === 'auth0') {
        return res.json({
            sucesso: true,
            provider,
            redirectUrl: '/api/auth/auth0/login'
        });
    }

    const { email, password } = req.body || {};
    if (!validateEmail(email) || !password) {
        return res.status(400).json({ erro: 'Informe e-mail e senha válidos.' });
    }

    const user = await findAuthUserByEmail(email);
    if (!user?.passwordHash) {
        return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
        return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }

    if (!user.emailVerifiedAt) {
        return res.status(403).json({
            erro: 'Confirme seu e-mail antes de entrar.',
            verificationRequired: true,
            nextStep: 'verify-email',
            redirectTo: clientPathForStep('verify-email')
        });
    }

    const updatedUser = await updateAuthAndLegacyUser(user.id, { lastLoginAt: nowIso() });
    return issueAuthenticatedResponse({
        req,
        res,
        user: updatedUser,
        provider: 'password',
        message: 'Login realizado com sucesso.'
    });
}

async function verifyEmail(req, res) {
    const parsed = parseScopedOpaqueToken(req.body?.token);
    if (!parsed) {
        return res.status(400).json({ erro: 'Link de verificação inválido.' });
    }

    const user = await findAuthUserById(parsed.userId);
    const emailVerification = user?.emailVerification;
    if (!user || !emailVerification?.tokenHash) {
        return res.status(400).json({ erro: 'Este link de verificação é inválido ou já foi usado.' });
    }
    if (!isFutureDate(emailVerification.expiresAt)) {
        return res.status(400).json({ erro: 'Este link expirou. Solicite um novo e-mail de verificação.' });
    }
    if (emailVerification.tokenHash !== parsed.tokenHash) {
        return res.status(400).json({ erro: 'Este link de verificação é inválido.' });
    }

    let nextUser = await updateAuthAndLegacyUser(user.id, {
        emailVerifiedAt: nowIso(),
        emailVerification: null,
        lastLoginAt: nowIso()
    });
    await completeOnboardingStep(nextUser.id, 'verify-email', {
        verifiedAt: nextUser.emailVerifiedAt
    });
    nextUser = await findAuthUserById(nextUser.id);

    return issueAuthenticatedResponse({
        req,
        res,
        user: nextUser,
        provider: 'email-verification',
        message: 'E-mail verificado com sucesso.'
    });
}

async function resendVerification(req, res) {
    const normalizedEmail = normalizeEmail(req.body?.email);
    if (!validateEmail(normalizedEmail)) {
        return res.status(400).json({ erro: 'Informe um e-mail válido.' });
    }

    const user = await findAuthUserByEmail(normalizedEmail);
    if (!user) {
        return res.json({
            sucesso: true,
            mensagem: 'Se existir uma conta com este e-mail, enviaremos um novo link.'
        });
    }
    if (user.emailVerifiedAt) {
        return res.json({
            sucesso: true,
            mensagem: 'Se sua conta já estiver ativa, você já pode entrar normalmente.'
        });
    }
    if (isCooldownActive(user.emailVerification?.sentAt)) {
        const retryAfter = resendRetrySeconds(user.emailVerification?.sentAt);
        return res.status(429).json({
            erro: `Aguarde ${retryAfter}s antes de solicitar outro e-mail.`,
            retryAfter
        });
    }

    const verification = await sendVerificationLink(user);
    return res.json({
        sucesso: true,
        mensagem: 'Novo e-mail de verificação enviado.',
        ...responseTokenPreview(verification.token)
    });
}

async function forgotPassword(req, res) {
    const normalizedEmail = normalizeEmail(req.body?.email);
    if (!validateEmail(normalizedEmail)) {
        return res.status(400).json({ erro: 'Informe um e-mail válido.' });
    }

    const user = await findAuthUserByEmail(normalizedEmail);
    if (!user) {
        return res.json({
            sucesso: true,
            mensagem: 'Se existir uma conta com este e-mail, enviaremos um link de recuperação.'
        });
    }

    const reset = await sendPasswordResetLink(user);
    return res.json({
        sucesso: true,
        mensagem: 'Se existir uma conta com este e-mail, enviaremos um link de recuperação.',
        ...responseTokenPreview(reset.token)
    });
}

async function resetPassword(req, res) {
    const { token, password } = req.body || {};
    const parsed = parseScopedOpaqueToken(token);
    if (!parsed) {
        return res.status(400).json({ erro: 'Link de redefinição inválido.' });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        return res.status(400).json({ erro: passwordValidation.message, code: passwordValidation.code });
    }

    const user = await findAuthUserById(parsed.userId);
    const passwordReset = user?.passwordReset;
    if (!user || !passwordReset?.tokenHash) {
        return res.status(400).json({ erro: 'Este link de redefinição é inválido ou já foi usado.' });
    }
    if (!isFutureDate(passwordReset.expiresAt)) {
        return res.status(400).json({ erro: 'Este link expirou. Solicite uma nova recuperação de senha.' });
    }
    if (passwordReset.tokenHash !== parsed.tokenHash) {
        return res.status(400).json({ erro: 'Este link de redefinição é inválido.' });
    }

    await revokeUserSessions(user.id, 'password-reset');
    const nextUser = await updateAuthAndLegacyUser(user.id, {
        passwordHash: await hashPassword(password),
        passwordReset: null,
        providers: {
            ...(user.providers || {}),
            password: {
                enabledAt: nowIso()
            }
        },
        lastLoginAt: nowIso()
    });

    return issueAuthenticatedResponse({
        req,
        res,
        user: nextUser,
        provider: 'password',
        message: 'Senha redefinida com sucesso.'
    });
}

async function logout(req, res) {
    const sessionId = req.auth?.sid;
    if (sessionId) {
        await revokeSession(sessionId, 'logout');
    }
    return res.json({ sucesso: true });
}

async function getSession(req, res) {
    const user = await findAuthUserByEmail(req.userEmail);
    if (!user) {
        return res.json({
            sucesso: true,
            session: {
                email: req.userEmail,
                provider: req.auth?.provider || 'legacy',
                expiresAt: req.auth?.exp ? new Date(req.auth.exp * 1000).toISOString() : null
            }
        });
    }

    const onboarding = await ensureOnboardingState(user);
    let session = null;
    if (req.auth?.sid) {
        session = await findSessionById(req.auth.sid);
    }

    return res.json({
        sucesso: true,
        session: {
            id: session?.id || null,
            email: user.email,
            provider: session?.provider || req.auth?.provider || 'password',
            expiresAt: session?.expiresAt || (req.auth?.exp ? new Date(req.auth.exp * 1000).toISOString() : null)
        },
        user: publicAuthUser(user, onboarding),
        onboarding,
        redirectTo: clientPathForStep(onboarding.currentStep)
    });
}

async function getOnboardingStateHandler(req, res) {
    const user = await findAuthUserByEmail(req.userEmail);
    if (!user) {
        return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }
    const onboarding = await ensureOnboardingState(user);
    return res.json({
        sucesso: true,
        onboarding,
        redirectTo: clientPathForStep(onboarding.currentStep)
    });
}

async function saveOnboardingStateHandler(req, res) {
    const user = await findAuthUserByEmail(req.userEmail);
    if (!user) {
        return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    const step = normalizeStep(req.body?.step);
    if (!step) {
        return res.status(400).json({ erro: 'Etapa de onboarding inválida.' });
    }
    const data = req.body?.data && typeof req.body.data === 'object' ? req.body.data : {};
    const completed = req.body?.completed === true;

    let nextUser = user;
    if (step === 'profile') {
        nextUser = await updateAuthAndLegacyUser(user.id, {
            profile: {
                name: data.name !== undefined ? String(data.name || '').trim() : user.profile?.name || '',
                avatarUrl: data.avatarUrl !== undefined ? String(data.avatarUrl || '').trim() : user.profile?.avatarUrl || '',
                usageType: data.usageType !== undefined ? String(data.usageType || '').trim() : user.profile?.usageType || ''
            }
        });
    }
    if (step === 'plan' && data.plan !== undefined) {
        nextUser = await updateAuthAndLegacyUser(user.id, {
            plan: String(data.plan || '').trim() || user.plan || 'freemium'
        });
    }
    if (step === 'template' && data.templateKey !== undefined) {
        nextUser = await updateAuthAndLegacyUser(user.id, {
            templateKey: String(data.templateKey || '').trim()
        });
    }

    const onboarding = completed
        ? await completeOnboardingStep(user.id, step, data)
        : await saveOnboardingState(user.id, { step, data, completed: false });

    return res.json({
        sucesso: true,
        user: publicAuthUser(nextUser, onboarding),
        onboarding,
        redirectTo: clientPathForStep(onboarding.currentStep)
    });
}

async function completeOnboardingStepHandler(req, res) {
    const user = await findAuthUserByEmail(req.userEmail);
    if (!user) {
        return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    const step = normalizeStep(req.body?.step);
    if (!step) {
        return res.status(400).json({ erro: 'Etapa de onboarding inválida.' });
    }
    const data = req.body?.data && typeof req.body.data === 'object' ? req.body.data : {};
    const onboarding = await completeOnboardingStep(user.id, step, data);
    return res.json({
        sucesso: true,
        onboarding,
        redirectTo: clientPathForStep(onboarding.currentStep)
    });
}

async function startOAuth(req, res) {
    const provider = String(req.params?.provider || '').trim().toLowerCase();
    try {
        const oauth = buildOAuthStartUrl(provider, {
            mode: String(req.query?.mode || 'login'),
            returnTo: String(req.query?.returnTo || '/dashboard')
        });
        return res.redirect(oauth.url);
    } catch (error) {
        return res.status(503).json({ erro: error.message || 'OAuth temporariamente indisponível.' });
    }
}

async function oauthCallback(req, res) {
    const provider = String(req.params?.provider || '').trim().toLowerCase();
    try {
        const { code, state } = req.query || {};
        if (!code || !state) {
            return res.status(400).json({ erro: 'Parâmetros OAuth incompletos.' });
        }

        const statePayload = parseOAuthState(state);
        if (statePayload.provider !== provider) {
            return res.status(400).json({ erro: 'Estado OAuth inválido para este provedor.' });
        }
        const tokenResponse = await exchangeOAuthCode(provider, code);
        const profile = await fetchOAuthProfile(provider, tokenResponse);
        const normalizedEmail = normalizeEmail(profile.email);

        let user = await findAuthUserByEmail(normalizedEmail);
        if (!user) {
            user = await createAuthUser({
                email: normalizedEmail,
                emailVerifiedAt: profile.emailVerified ? nowIso() : null,
                providers: {
                    [provider]: {
                        id: profile.providerAccountId,
                        linkedAt: nowIso()
                    }
                },
                profile: {
                    name: profile.name || '',
                    avatarUrl: profile.avatarUrl || '',
                    usageType: ''
                },
                plan: 'freemium'
            });
            await syncLegacyUserRecord(user);
        } else {
            user = await updateAuthAndLegacyUser(user.id, {
                emailVerifiedAt: profile.emailVerified ? (user.emailVerifiedAt || nowIso()) : user.emailVerifiedAt,
                providers: {
                    ...(user.providers || {}),
                    [provider]: {
                        id: profile.providerAccountId,
                        linkedAt: nowIso()
                    }
                },
                profile: {
                    name: user.profile?.name || profile.name || '',
                    avatarUrl: profile.avatarUrl || user.profile?.avatarUrl || '',
                    usageType: user.profile?.usageType || ''
                },
                lastLoginAt: nowIso()
            });
        }

        await completeOnboardingStep(user.id, 'verify-email', {
            provider,
            verifiedAt: user.emailVerifiedAt || nowIso()
        });

        const onboarding = await ensureOnboardingState(user);
        const session = await createSession({
            user,
            provider,
            ...requestMetadata(req),
            expiresAt: sessionExpiry()
        });
        const finalToken = issueSessionToken({
            userId: user.id,
            sessionId: session.id,
            email: user.email,
            provider
        });

        const nextPath = onboarding.currentStep === 'dashboard'
            ? (statePayload.returnTo || '/dashboard')
            : clientPathForStep(onboarding.currentStep);
        const redirectUrl = new URL('/', resolveBaseUrl());
        redirectUrl.searchParams.set('token', finalToken.token);
        redirectUrl.searchParams.set('email', user.email);
        redirectUrl.searchParams.set('provider', provider);
        redirectUrl.searchParams.set('next', nextPath);

        return res.redirect(redirectUrl.toString());
    } catch (error) {
        const redirectUrl = new URL('/', resolveBaseUrl());
        redirectUrl.searchParams.set('oauth_error', error.message || 'Falha ao autenticar.');
        redirectUrl.searchParams.set('provider', provider);
        return res.redirect(redirectUrl.toString());
    }
}

module.exports = {
    register,
    login,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    logout,
    getSession,
    getOnboardingState: getOnboardingStateHandler,
    saveOnboardingState: saveOnboardingStateHandler,
    completeOnboardingStep: completeOnboardingStepHandler,
    startOAuth,
    oauthCallback
};
