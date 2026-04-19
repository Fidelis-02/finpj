export default async function handler(req, res) {
    const cnpj = String(req.query.cnpj || '').replace(/\D/g, '');

    if (cnpj.length !== 14) {
        return res.status(400).json({ erro: 'CNPJ inválido' });
    }

    try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
        let data;
        try {
            data = await response.json();
        } catch {
            return res.status(502).json({ erro: 'Resposta inválida da consulta de CNPJ' });
        }

        if (!response.ok || data.message || data.type === 'bad_request') {
            const msg = data.message || data.error || 'CNPJ não encontrado';
            return res.status(404).json({ ativo: false, erro: msg });
        }

        const situacao = String(data.descricao_situacao_cadastral || '').toUpperCase();
        const situacaoNum = String(data.codigo_situacao_cadastral || '');
        const ativo =
            situacao.includes('ATIV') ||
            situacaoNum === '02' ||
            situacaoNum === '2';

        const resultado = {
            ativo,
            nome: data.razao_social || '',
            fantasia: data.nome_fantasia || '',
            uf: data.uf,
            municipio: data.municipio,
            cnae_fiscal: data.cnae_fiscal,
            cnae_descricao: data.cnae_fiscal_descricao || '',
            cnae: data.cnae_fiscal_descricao || ''
        };

        return res.status(200).json(resultado);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ erro: 'Erro ao consultar CNPJ' });
    }
}
