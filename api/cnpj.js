export default async function handler(req, res) {
    const { cnpj } = req.query;

    if (!cnpj) {
        return res.status(400).json({ erro: 'CNPJ não informado' });
    }

    try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
        const data = await response.json();

        if (data.status === 'ATIVA') {
            return res.status(200).json({ ativo: true, dados: data });
        } else {
            return res.status(200).json({ ativo: false, dados: data });
        }

    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao consultar CNPJ' });
    }
}