const { obterUsuario, obterUsuarioPorCnpj, conectarDB } = require('../services/database');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? require('stripe')(stripeSecretKey) : null;

function obterValorPlano(plano) {
    const valores = {
        starter: 490,
        growth: 950,
        enterprise: 1850
    };
    return valores[plano] || 490;
}

function normalizarPlano(plano) {
    return typeof plano === 'string' ? plano.trim().toLowerCase() : '';
}

function isEmailValido(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function obterOrigin(req) {
    if (req.headers.origin) return req.headers.origin;
    return `${req.protocol}://${req.get('host')}`;
}

async function resolverIdentidadePagamento(req, emailBody) {
    const emailBodyNormalizado = typeof emailBody === 'string' ? emailBody.trim().toLowerCase() : '';
    const emailToken = req.userEmail || '';
    const usuario = emailToken ? await obterUsuario(emailToken) : null;
    const email = (emailToken || emailBodyNormalizado || '').trim().toLowerCase();
    const cnpj = usuario?.cnpj ? String(usuario.cnpj).replace(/\D/g, '') : '';
    const customerEmail = isEmailValido(email) && !email.endsWith('@finpj.local') ? email : undefined;

    return { email, cnpj, customerEmail };
}

async function criarCheckoutHospedado(req, { email, cnpj, plano }) {
    const valor = obterValorPlano(plano);

    return stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
            {
                price_data: {
                    currency: 'brl',
                    product_data: {
                        name: `FinPJ - Plano ${plano.charAt(0).toUpperCase() + plano.slice(1)}`
                    },
                    unit_amount: valor * 100
                },
                quantity: 1
            }
        ],
        ...(email ? { customer_email: email } : {}),
        metadata: {
            ...(email ? { email } : {}),
            ...(cnpj ? { cnpj } : {}),
            plan: plano
        },
        success_url: `${obterOrigin(req)}/?pagamento=sucesso&plan=${plano}`,
        cancel_url: `${obterOrigin(req)}/?pagamento=cancelado`
    });
}

async function processarPagamento(req, res) {
    if (!stripe) {
        return res.status(500).json({ erro: 'Checkout indisponível no momento. Tente novamente mais tarde.' });
    }

    const plano = normalizarPlano(req.body && req.body.plano);
    if (!plano || !['starter', 'growth', 'enterprise'].includes(plano)) {
        return res.status(400).json({ erro: 'Plano inválido.' });
    }

    try {
        const identidade = await resolverIdentidadePagamento(req, req.body?.email);
        if (!identidade.email && !identidade.cnpj) {
            return res.status(400).json({ erro: 'Não foi possível identificar o usuário para iniciar o pagamento.' });
        }

        const session = await criarCheckoutHospedado(req, {
            email: identidade.customerEmail,
            cnpj: identidade.cnpj,
            plano
        });

        res.json({ sucesso: true, checkoutUrl: session.url });
    } catch (erro) {
        console.error('Stripe checkout error:', erro);
        res.status(500).json({ erro: 'Erro ao criar sessão de pagamento. Tente novamente mais tarde.' });
    }
}

async function createCheckoutSession(req, res) {
    if (!stripe) {
        return res.status(500).json({ erro: 'Checkout indisponível no momento.' });
    }

    const plano = normalizarPlano(req.body && (req.body.planId || req.body.plano));
    if (!plano || !['starter', 'growth', 'enterprise'].includes(plano)) {
        return res.status(400).json({ erro: 'Plano inválido.' });
    }

    try {
        const identidade = await resolverIdentidadePagamento(req, req.body?.email);
        if (!identidade.email && !identidade.cnpj) {
            return res.status(400).json({ erro: 'Não foi possível identificar o usuário para iniciar o pagamento.' });
        }

        const session = await criarCheckoutHospedado(req, {
            email: identidade.customerEmail,
            cnpj: identidade.cnpj,
            plano
        });

        res.send({ checkoutUrl: session.url });
    } catch (e) {
        res.status(500).send({ error: e.message });
    }
}

async function webhookStripe(req, res) {
    if (!stripe) {
        return res.status(500).send('Checkout indisponível no momento.');
    }

    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!endpointSecret) {
        console.error('STRIPE_WEBHOOK_SECRET não configurado.');
        return res.status(500).send('Webhook secret não configurado.');
    }

    const sig = req.headers['stripe-signature'] || (req.get && req.get('stripe-signature'));
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('Falha na verificacao do webhook Stripe:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (!event) return res.json({ received: true });

    // Idempotency check
    try {
        const db = await conectarDB();
        const webhookColl = db.collection('webhookEvents');
        try {
            await webhookColl.createIndex({ id: 1 }, { unique: true });
        } catch (e) {
            // Índice já existe.
        }
        try {
            await webhookColl.insertOne({ id: event.id, type: event.type, receivedAt: new Date() });
        } catch (dupErr) {
            if (dupErr && dupErr.code === 11000) {
                console.log('Webhook event já processado:', event.id);
                return res.json({ received: true });
            }
            throw dupErr;
        }
    } catch (dbErr) {
        console.error('Falha ao verificar idempotência do webhook:', dbErr.message);
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object);
                break;
            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object);
                break;
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;
            case 'invoice.payment_failed':
                await handleInvoicePaymentFailed(event.data.object);
                break;
            default:
                console.log(`Webhook Stripe não tratado: ${event.type}`);
        }
    } catch (e) {
        console.error(`Erro ao processar webhook ${event.type}:`, e.message || e);
    }

    return res.json({ received: true });
}

async function handleCheckoutCompleted(session) {
    const emailMetadata = session.metadata && session.metadata.email;
    const cnpjMetadata = session.metadata && session.metadata.cnpj;
    const plano = normalizarPlano(session.metadata && session.metadata.plan);

    if (!plano || (!emailMetadata && !cnpjMetadata)) {
        console.error('Webhook checkout sem metadata completa', { emailMetadata, cnpjMetadata, plano, sessionId: session.id });
        return;
    }

    const db = await conectarDB();
    let usuario = null;

    if (emailMetadata) {
        usuario = await obterUsuario(emailMetadata);
    }
    if (!usuario && cnpjMetadata) {
        usuario = await obterUsuarioPorCnpj(cnpjMetadata);
    }
    if (!usuario) {
        console.error('Usuário não encontrado para checkout', { emailMetadata, cnpjMetadata, sessionId: session.id });
        return;
    }

    const filtroUsuario = usuario.cnpj
        ? { cnpj: String(usuario.cnpj).replace(/\D/g, '') }
        : { email: usuario.email };

    await db.collection('usuarios').updateOne(
        filtroUsuario,
        {
            $set: {
                plano,
                planAtivadoEm: new Date(),
                statusPagamento: 'aprovado',
                stripeSessionId: session.id,
                stripePaymentIntentId: session.payment_intent || null,
                stripeCustomerId: session.customer || null,
                stripeSubscriptionId: session.subscription || null,
                updatedAt: new Date()
            }
        }
    );

    console.log(`Webhook: Plano ${plano} ativado para ${usuario.email}`);
}

async function handleSubscriptionUpdated(subscription) {
    const customerId = subscription.customer;
    if (!customerId) return;

    const db = await conectarDB();
    const usuario = await db.collection('usuarios').findOne({ stripeCustomerId: customerId });
    if (!usuario) {
        console.warn(`Webhook subscription.updated: customer ${customerId} não encontrado`);
        return;
    }

    const status = subscription.status; // active, past_due, canceled, unpaid
    const planoAtual = usuario.plano;
    
    // Map Stripe subscription status to internal payment status
    const statusMap = {
        active: 'aprovado',
        past_due: 'pendente',
        canceled: 'cancelado',
        unpaid: 'falha',
        trialing: 'trial',
        incomplete: 'pendente',
        incomplete_expired: 'expirado',
        paused: 'pausado'
    };

    const filtroUsuario = usuario.cnpj
        ? { cnpj: String(usuario.cnpj).replace(/\D/g, '') }
        : { email: usuario.email };

    await db.collection('usuarios').updateOne(
        filtroUsuario,
        {
            $set: {
                statusPagamento: statusMap[status] || status,
                stripeSubscriptionStatus: status,
                stripeSubscriptionId: subscription.id,
                subscriptionCurrentPeriodEnd: subscription.current_period_end
                    ? new Date(subscription.current_period_end * 1000)
                    : null,
                updatedAt: new Date()
            }
        }
    );

    console.log(`Webhook: Subscription ${status} para ${usuario.email} (plano: ${planoAtual})`);
}

async function handleSubscriptionDeleted(subscription) {
    const customerId = subscription.customer;
    if (!customerId) return;

    const db = await conectarDB();
    const usuario = await db.collection('usuarios').findOne({ stripeCustomerId: customerId });
    if (!usuario) {
        console.warn(`Webhook subscription.deleted: customer ${customerId} não encontrado`);
        return;
    }

    const filtroUsuario = usuario.cnpj
        ? { cnpj: String(usuario.cnpj).replace(/\D/g, '') }
        : { email: usuario.email };

    await db.collection('usuarios').updateOne(
        filtroUsuario,
        {
            $set: {
                plano: 'freemium',
                statusPagamento: 'cancelado',
                stripeSubscriptionStatus: 'canceled',
                subscriptionCanceledAt: new Date(),
                updatedAt: new Date()
            }
        }
    );

    console.log(`Webhook: Assinatura cancelada para ${usuario.email}, revertido para freemium`);
}

async function handleInvoicePaymentFailed(invoice) {
    const customerId = invoice.customer;
    if (!customerId) return;

    const db = await conectarDB();
    const usuario = await db.collection('usuarios').findOne({ stripeCustomerId: customerId });
    if (!usuario) {
        console.warn(`Webhook invoice.payment_failed: customer ${customerId} não encontrado`);
        return;
    }

    const filtroUsuario = usuario.cnpj
        ? { cnpj: String(usuario.cnpj).replace(/\D/g, '') }
        : { email: usuario.email };

    const attemptCount = invoice.attempt_count || 1;

    await db.collection('usuarios').updateOne(
        filtroUsuario,
        {
            $set: {
                statusPagamento: 'falha',
                paymentFailedAt: new Date(),
                paymentFailedAttempts: attemptCount,
                paymentFailedInvoiceId: invoice.id,
                updatedAt: new Date()
            }
        }
    );

    console.log(`Webhook: Pagamento falhou para ${usuario.email} (tentativa ${attemptCount})`);
}

module.exports = {
    processarPagamento,
    createCheckoutSession,
    webhookStripe
};
