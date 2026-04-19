const { getUserByCnpj, saveUser, hashCode, generateBankReports } = require('../lib/auth-storage');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    const { cnpj, password } = req.body || {};
    if (!cnpj || !password || password.length < 6) {
        return res.status(400).json({ erro: 'CNPJ e senha (mínimo 6 caracteres) são obrigatórios' });
    }

    let user = await getUserByCnpj(cnpj);
    if (user) {
        return res.status(400).json({ erro: 'CNPJ já cadastrado.' });
    }

    user = {
        cnpj,
        passwordHash: await hashCode(password),
        email: `cnpj-${cnpj}@finpj.local`,
        createdAt: new Date().toISOString(),
        bankReports: generateBankReports(`cnpj-${cnpj}`)
    };

    await saveUser(user);

    return res.status(200).json({ sucesso: true, mensagem: 'Conta criada com sucesso.' });
};
