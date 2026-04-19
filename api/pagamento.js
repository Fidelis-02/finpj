import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    try {
        const { plano, email } = req.body;

        const valores = {
            starter: 490,
            growth: 950,
            enterprise: 1850
        };

        const valor = valores[plano] || 490;

        const paymentIntent = await stripe.paymentIntents.create({
            amount: valor * 100, // centavos
            currency: 'brl',
            receipt_email: email,
            automatic_payment_methods: {
                enabled: true
            },
            metadata: {
                plano
            }
        });

        return res.status(200).json({
            clientSecret: paymentIntent.client_secret
        });

    } catch (erro) {
        console.error(erro);
        return res.status(500).json({
            erro: 'Erro ao criar pagamento'
        });
    }
}