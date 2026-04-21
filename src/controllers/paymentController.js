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
        return res.status(500).json({ erro: 'Stripe nao esta configurado. Defina STRIPE_SECRET_KEY.' });
    }

    const plano = normalizarPlano(req.body && req.body.plano);
    if (!plano || !['starter', 'growth', 'enterprise'].includes(plano)) {
        return res.status(400).json({ erro: 'Plano invalido.' });
    }

    try {
        const identidade = await resolverIdentidadePagamento(req, req.body?.email);
        if (!identidade.email && !identidade.cnpj) {
            return res.status(400).json({ erro: 'Nao foi possivel identificar o usuario para iniciar o pagamento.' });
        }

        const session = await criarCheckoutHospedado(req, {
            email: identidade.customerEmail,
            cnpj: identidade.cnpj,
            plano
        });

        res.json({ sucesso: true, checkoutUrl: session.url });
    } catch (erro) {
        console.error('Stripe checkout error:', erro);
        res.status(500).json({ erro: 'Erro ao criar sessao de pagamento. Tente novamente mais tarde.' });
    }
}

async function createCheckoutSession(req, res) {
    if (!stripe) {
        return res.status(500).json({ erro: 'Stripe nao esta configurado.' });
    }

    const plano = normalizarPlano(req.body && (req.body.planId || req.body.plano));
    if (!plano || !['starter', 'growth', 'enterprise'].includes(plano)) {
        return res.status(400).json({ erro: 'Plano invalido.' });
    }

    try {
        const identidade = await resolverIdentidadePagamento(req, req.body?.email);
        if (!identidade.email && !identidade.cnpj) {
            return res.status(400).json({ erro: 'Nao foi possivel identificar o usuario para iniciar o pagamento.' });
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
        return res.status(500).send('Stripe nao esta configurado.');
    }

    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!endpointSecret) {
        console.error('STRIPE_WEBHOOK_SECRET nao configurado.');
        return res.status(500).send('Webhook secret nao configurado.');
    }

    const sig = req.headers['stripe-signature'] || (req.get && req.get('stripe-signature'));
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('Falha na verificacao do webhook Stripe:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event && event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const emailMetadata = session.metadata && session.metadata.email;
        const cnpjMetadata = session.metadata && session.metadata.cnpj;
        const plano = normalizarPlano(session.metadata && session.metadata.plan);

        if (!plano || (!emailMetadata && !cnpjMetadata)) {
            console.error('Webhook recebido sem metadata completa', { emailMetadata, cnpjMetadata, plano, sessionId: session.id });
            return res.status(400).send('Metadata invalida');
        }

        try {
            const db = await conectarDB();
            let usuario = null;

            if (emailMetadata) {
                usuario = await obterUsuario(emailMetadata);
            }
            if (!usuario && cnpjMetadata) {
                usuario = await obterUsuarioPorCnpj(cnpjMetadata);
            }
            if (!usuario) {
                console.error('Usuario nao encontrado para webhook', { emailMetadata, cnpjMetadata, sessionId: session.id });
                return res.status(400).send('Usuario nao encontrado');
            }

            const webhookColl = db.collection('webhookEvents');
            try {
                await webhookColl.createIndex({ id: 1 }, { unique: true });
            } catch (e) {
                // indice ja existe
            }

            try {
                await webhookColl.insertOne({ id: event.id, type: event.type, receivedAt: new Date() });
            } catch (dupErr) {
                if (dupErr && dupErr.code === 11000) {
                    console.log('Webhook event ja processado:', event.id);
                    return res.json({ received: true });
                }
                throw dupErr;
            }

            const filtroUsuario = usuario.cnpj
                ? { cnpj: String(usuario.cnpj).replace(/\D/g, '') }
                : { email: usuario.email };

            const updateResult = await db.collection('usuarios').updateOne(
                filtroUsuario,
                {
                    $set: {
                        plano,
                        planAtivadoEm: new Date(),
                        statusPagamento: 'aprovado',
                        stripeSessionId: session.id,
                        stripePaymentIntentId: session.payment_intent || null,
                        stripeCustomerId: session.customer || null,
                        updatedAt: new Date()
                    }
                }
            );

            if (updateResult.matchedCount === 0) {
                console.error('Usuario nao encontrado ao atualizar plano', { filtroUsuario, sessionId: session.id });
                return res.status(400).send('Usuario nao encontrado');
            }

            console.log(`Webhook: Plano ${plano} ativado para ${usuario.email}`);
            return res.json({ received: true });
        } catch (e) {
            console.error('Erro ao processar webhook:', e.message || e);
            return res.json({ received: true, error: e.message });
        }
    }

    res.json({ received: true });
}

module.exports = {
    processarPagamento,
    createCheckoutSession,
    webhookStripe
};
