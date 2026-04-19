export default async function handler(req, res) {
    const cnpj = String(req.query.cnpj || '').replace(/\D/g, '');

    if (cnpj.length !== 14) {
        return res.status(400).json({ erro: 'CNPJ inválido' });
    }

    try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
        const data = await response.json();

        if (!response.ok || data.message) {
            return res.status(404).json({ ativo: false });
        }

        const resultado = {
            ativo: data.descricao_situacao_cadastral === 'ATIVA',
            nome: data.razao_social,
            fantasia: data.nome_fantasia,
            uf: data.uf,
            municipio: data.municipio,
            cnae: data.cnae_fiscal_descricao
        };

        return res.status(200).json(resultado);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ erro: 'Erro ao consultar CNPJ' });
    }
}
