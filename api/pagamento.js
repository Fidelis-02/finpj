const Stripe = require('stripe');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

function obterValorPlano(plano) {
    const valores = {
        starter: 490,
        growth: 950,
        enterprise: 1850
    };
    return valores[plano] || 490;
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ erro: 'Método não permitido.' });
    }

    if (!stripe) {
        return res.status(500).json({ erro: 'Checkout indisponível no momento. Tente novamente mais tarde.' });
    }

    try {
        const { plano, email } = req.body;
        const valor = obterValorPlano(plano);
        const origin = req.headers.origin || `https://${req.headers.host}`;

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
            success_url: `${origin}/?pagamento=sucesso`,
            cancel_url: `${origin}/?pagamento=cancelado`
        });

        return res.status(200).json({ checkoutUrl: session.url });
    } catch (erro) {
        console.error(erro);
        return res.status(500).json({ erro: 'Erro ao criar sessão de pagamento.' });
    }
};
