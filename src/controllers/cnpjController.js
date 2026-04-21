const { obterUsuarioPorCnpj } = require('../services/database');
const { consultarCnpjBrasilApi, consultarCnpjReceitaWs } = require('../services/cnpjService');

const cacheCNPJ = {};

async function consultarCnpj(req, res) {
    const cnpj = (req.query.cnpj || '').replace(/\D/g, '');

    if (cnpj.length !== 14) {
        return res.status(400).json({ erro: 'CNPJ inválido' });
    }

    const usuarioExistente = await obterUsuarioPorCnpj(cnpj);
    if (usuarioExistente) {
        return res.status(400).json({ erro: 'Este CNPJ já possui uma conta. Por favor, faça login.' });
    }

    if (cacheCNPJ[cnpj]) {
        return res.json(cacheCNPJ[cnpj]);
    }

    try {
        const b = await consultarCnpjBrasilApi(cnpj);
        if (b.ok && b.mapped) {
            cacheCNPJ[cnpj] = b.mapped;
            return res.json(b.mapped);
        }

        const r = await consultarCnpjReceitaWs(cnpj);
        if (r.ok && r.mapped) {
            cacheCNPJ[cnpj] = r.mapped;
            return res.json(r.mapped);
        }

        const msg =
            (b.data && b.data.message) ||
            r.erro ||
            'Não foi possível localizar este CNPJ nas bases públicas.';
        return res.status(404).json({ ativo: false, erro: msg });
    } catch (err) {
        console.error(err);
        const detalhe = err && err.name === 'AbortError' ? 'Tempo esgotado ao consultar o CNPJ.' : 'Falha de rede ao consultar o CNPJ.';
        return res.status(502).json({ erro: detalhe });
    }
}

module.exports = {
    consultarCnpj
};
