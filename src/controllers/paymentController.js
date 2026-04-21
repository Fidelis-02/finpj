const { obterUsuarioPorCnpj, salvarUsuario } = require('../services/database');

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
    const event = req.body;
    if (event && event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const cnpj = session.metadata.cnpj;
        const plano = session.metadata.plan;
        const usuario = await obterUsuarioPorCnpj(cnpj);
        if (usuario) {
            usuario.plano = plano;
            await salvarUsuario(usuario);
        }
    }
    res.json({ received: true });
}

module.exports = {
    processarPagamento,
    createCheckoutSession,
    webhookStripe
};
