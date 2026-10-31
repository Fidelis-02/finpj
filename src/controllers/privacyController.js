const { excluirDadosConta } = require('../services/database');
const { findAuthUserByEmail, revokeUserSessions } = require('../services/authStore');

async function deleteAccount(req, res) {
    if (req.body?.confirmation !== 'EXCLUIR') {
        return res.status(400).json({
            erro: 'Confirmação inválida. Envie confirmation=EXCLUIR para excluir a conta.'
        });
    }

    try {
        const user = await findAuthUserByEmail(req.userEmail);
        const result = await excluirDadosConta(req.userEmail, user?.id);
        if (user?.id) await revokeUserSessions(user.id);
        return res.json({
            sucesso: true,
            mensagem: 'Conta e dados operacionais excluídos.'
        });
    } catch (error) {
        console.error('Erro ao excluir conta:', error);
        return res.status(503).json({
            erro: 'Não foi possível concluir a exclusão da conta. Tente novamente.'
        });
    }
}

module.exports = { deleteAccount };
