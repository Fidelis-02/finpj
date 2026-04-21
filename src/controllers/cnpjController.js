const { obterUsuarioPorCnpj } = require('../services/database');
const { consultarCnpjBrasilApi, consultarCnpjReceitaWs } = require('../services/cnpjService');

const cacheCNPJ = {};

async function consultarCnpj(req, res) {
    const cnpj = String(req.query.cnpj || '').replace(/\D/g, '');

    if (cnpj.length !== 14) {
        return res.status(400).json({ erro: 'CNPJ inválido.' });
    }

    const context = String(req.query.context || '').toLowerCase();
    const skipDuplicateCheck = ['simulator', 'diagnostic', 'public'].includes(context);

    if (!skipDuplicateCheck) {
        try {
            const usuarioExistente = await obterUsuarioPorCnpj(cnpj);
            if (usuarioExistente) {
                return res.status(400).json({ erro: 'Este CNPJ já possui uma conta. Por favor, faça login.' });
            }
        } catch (err) {
            console.warn('Não foi possível verificar duplicidade do CNPJ antes da consulta pública:', err.message);
        }
    }

    if (cacheCNPJ[cnpj]) {
        return res.json(cacheCNPJ[cnpj]);
    }

    try {
        const brasilApi = await consultarCnpjBrasilApi(cnpj);
        if (brasilApi.ok && brasilApi.mapped) {
            cacheCNPJ[cnpj] = brasilApi.mapped;
            return res.json(brasilApi.mapped);
        }

        const receitaWs = await consultarCnpjReceitaWs(cnpj);
        if (receitaWs.ok && receitaWs.mapped) {
            cacheCNPJ[cnpj] = receitaWs.mapped;
            return res.json(receitaWs.mapped);
        }

        const msg =
            (brasilApi.data && brasilApi.data.message) ||
            receitaWs.erro ||
            'Não foi possível localizar este CNPJ nas bases públicas.';
        return res.status(404).json({ ativo: false, erro: msg });
    } catch (err) {
        console.error(err);
        const detalhe = err && err.name === 'AbortError'
            ? 'Tempo esgotado ao consultar o CNPJ.'
            : 'Falha de rede ao consultar o CNPJ.';
        return res.status(502).json({ erro: detalhe });
    }
}

module.exports = {
    consultarCnpj
};
