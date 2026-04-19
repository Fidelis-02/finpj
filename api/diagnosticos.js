export default function handler(req, res) {
    if (req.method === 'POST') {
        const { nome, cnpj, faturamento, margem } = req.body;

        const fat = parseInt(faturamento) || 4800000;
        const marg = parseFloat(margem) || 0.12;

        const impostoSimples = fat * 0.11;
        const impostoPresumido = fat * 0.15;
        const impostoReal = (fat * marg) * 0.24;

        const regimeIdeal =
            impostoSimples < impostoPresumido && impostoSimples < impostoReal
                ? 'Simples Nacional'
                : impostoPresumido < impostoReal
                ? 'Lucro Presumido'
                : 'Lucro Real';

        return res.status(200).json({
            sucesso: true,
            resultados: {
                regimeIdeal,
                impostos: {
                    simples: impostoSimples,
                    presumido: impostoPresumido,
                    real: impostoReal
                }
            }
        });
    }

    return res.status(405).json({ erro: 'Método não permitido' });
}