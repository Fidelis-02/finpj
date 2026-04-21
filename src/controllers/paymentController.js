const { obterUsuarioPorCnpj, salvarUsuario, conectarDB, lerDados, salvarDados } = require('../services/database');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? require('stripe')(stripeSecretKey) : null;

function obterValorPlano(plano) {
    const valores = {
        'starter': 490,
        'growth': 950,
        'enterprise': 1850
    };
    return valores[plano] || 490;
}

async function processarPagamento(req, res) {
    if (!stripe) {
        return res.status(500).json({ erro: 'Stripe não está configurado. Defina STRIPE_SECRET_KEY.' });
    }

    const { email, plano } = req.body;
    const valor = obterValorPlano(plano);

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: 'brl',
                        product_data: {
                            name: `FinPJ - Plano ${plano}`
                        },
                        unit_amount: valor * 100
                    },
                    quantity: 1
                }
            ],
            customer_email: email,
            success_url: `${req.protocol}://${req.get('host')}/?pagamento=sucesso`,
            cancel_url: `${req.protocol}://${req.get('host')}/?pagamento=cancelado`
        });

        res.json({ sucesso: true, checkoutUrl: session.url });
    } catch (erro) {
        console.error('Stripe checkout error:', erro);
        res.status(500).json({ erro: 'Erro ao criar sessão de pagamento. Tente novamente mais tarde.' });
    }
}

async function createCheckoutSession(req, res) {
    if (!stripe) {
        return res.status(500).json({ erro: 'Stripe não está configurado.' });
    }

    const { planId, cnpj } = req.body;
    try {
        const session = await stripe.checkout.sessions.create({
            ui_mode: 'embedded',
            line_items: [{
                price_data: {
                    currency: 'brl',
                    product_data: { name: `FinPJ - Plano ${planId.toUpperCase()}` },
                    unit_amount: planId === 'starter' ? 49000 : planId === 'growth' ? 95000 : 185000,
                    recurring: { interval: 'month' }
                },
                quantity: 1,
            }],
            mode: 'subscription',
            return_url: `${req.headers.origin}/?session_id={CHECKOUT_SESSION_ID}`,
            metadata: { cnpj, plan: planId }
        });
        res.send({ clientSecret: session.client_secret });
    } catch (e) {
        res.status(500).send({ error: e.message });
    }
}

async function webhookStripe(req, res) {
    if (!stripe) {
        return res.status(500).send('Stripe não está configurado.');
    }

    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!endpointSecret) {
        console.error('STRIPE_WEBHOOK_SECRET não configurado.');
        return res.status(500).send('Webhook secret não configurado.');
    }

    const sig = req.headers['stripe-signature'] || (req.get && req.get('stripe-signature'));
    let event;
    try {
        // req.body must be raw body (route uses express.raw). Use constructEvent for verification.
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('Falha na verificação do webhook Stripe:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event && event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const cnpjRaw = session.metadata && session.metadata.cnpj;
        const plano = session.metadata && session.metadata.plan;
        if (!cnpjRaw) {
            console.error('Webhook recebido sem metadata.cnpj', session.id);
            return res.status(400).send('Metadata inválida');
        }
        const cnpj = String(cnpjRaw).replace(/\D/g, '');
        // Idempotency: ensure we process each Stripe event only once
        try {
            const db = await conectarDB();
            if (db) {
                const coll = db.collection('webhookEvents');
                try {
                    await coll.createIndex({ id: 1 }, { unique: true });
                } catch (ie) { /* ignore index exists error */ }
                try {
                    await coll.insertOne({ id: event.id, type: event.type, receivedAt: new Date() });
                } catch (dupErr) {
                    // duplicate key means we've already processed this event
                    if (dupErr && dupErr.code === 11000) {
                        console.log('Webhook event already processed:', event.id);
                        return res.json({ received: true });
                    }
                    throw dupErr;
                }

                // Update user plan atomically
                const updateResult = await db.collection('usuarios').updateOne(
                    { cnpj: cnpj },
                    { $set: { plano: plano || undefined, updatedAt: new Date() } }
                );
                if (updateResult.matchedCount === 0) {
                    console.error(`Usuário não encontrado para CNPJ ${cnpj} (webhook)`);
                    return res.status(400).send('Usuário não encontrado');
                }
                return res.json({ received: true });
            }

            // Fallback when MongoDB unavailable: use dados.json deduplication
            const dados = lerDados();
            dados.webhookEvents = dados.webhookEvents || [];
            if (dados.webhookEvents.find(w => w.id === event.id)) {
                console.log('Webhook event already processed (fallback):', event.id);
                return res.json({ received: true });
            }
            dados.webhookEvents.push({ id: event.id, type: event.type, receivedAt: new Date().toISOString() });

            const usuario = await obterUsuarioPorCnpj(cnpj);
            if (!usuario) {
                console.error(`Usuário não encontrado para CNPJ ${cnpj} (webhook fallback)`);
                salvarDados(dados);
                return res.status(400).send('Usuário não encontrado');
            }
            usuario.plano = plano || usuario.plano;
            await salvarUsuario(usuario);
            salvarDados(dados);
            return res.json({ received: true });
        } catch (e) {
            console.error('Erro ao atualizar usuário via webhook:', e.message || e);
            return res.status(500).send('Erro interno');
        }
    }
    res.json({ received: true });
}

module.exports = {
    processarPagamento,
    createCheckoutSession,
    webhookStripe
};
