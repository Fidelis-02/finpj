const { obterUsuario, salvarUsuario } = require('../services/database');
const pluggyService = require('../services/pluggyService');

function gerarTransacoesMock(bankName) {
    const tipos = [
        { desc: 'PIX Recebido', tipo: 'entrada', cat: 'Receita' },
        { desc: 'PIX Enviado', tipo: 'saida', cat: 'Transferência' },
        { desc: 'Boleto Pago', tipo: 'saida', cat: 'Fornecedor' },
        { desc: 'TED Recebida', tipo: 'entrada', cat: 'Receita' },
        { desc: 'Tarifa Bancária', tipo: 'saida', cat: 'Taxa' },
        { desc: 'Pagamento Fornecedor', tipo: 'saida', cat: 'Fornecedor' },
        { desc: 'Recebimento Cliente', tipo: 'entrada', cat: 'Receita' },
        { desc: 'DAS Simples Nacional', tipo: 'saida', cat: 'Imposto' },
        { desc: 'Folha de Pagamento', tipo: 'saida', cat: 'RH' },
        { desc: 'Venda Cartão', tipo: 'entrada', cat: 'Receita' }
    ];

    const hoje = new Date();
    return Array.from({ length: 15 }, (_, index) => {
        const data = new Date(hoje);
        data.setDate(hoje.getDate() - index);
        const tipo = tipos[Math.floor(Math.random() * tipos.length)];
        const valor = Math.round((Math.random() * 18 + 0.3) * 1000);
        return {
            id: `${bankName}-${Date.now()}-${index}`,
            data: data.toISOString().slice(0, 10),
            descricao: tipo.desc,
            valor: tipo.tipo === 'entrada' ? valor : -valor,
            tipo: tipo.tipo,
            categoria: tipo.cat
        };
    });
}

async function carregarTransacoesPluggy(itemId, bankName) {
    const accounts = await pluggyService.getAccounts(itemId);
    if (!accounts.length) {
        return gerarTransacoesMock(bankName);
    }

    const transacoes = await pluggyService.getTransactions(accounts[0].id);
    if (!transacoes.length) {
        return gerarTransacoesMock(bankName);
    }

    return transacoes.map((transaction) => ({
        id: transaction.id,
        data: String(transaction.date || '').slice(0, 10),
        descricao: transaction.description,
        valor: transaction.amount,
        tipo: transaction.amount > 0 ? 'entrada' : 'saida',
        categoria: transaction.category || 'Outros'
    }));
}

async function getPluggyToken(req, res) {
    const result = await pluggyService.createConnectToken(req.userEmail);
    if (result.ok) {
        return res.json({ sucesso: true, token: result.token });
    }

    return res.status(result.statusCode || 500).json({
        erro: result.userMessage || 'Não foi possível gerar token da Pluggy.',
        detalhe: result.detail || null
    });
}

async function getBanks(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    return res.json({ sucesso: true, banks: usuario.connectedBanks || [] });
}

async function connectBank(req, res) {
    const { itemId } = req.body || {};
    if (!itemId) {
        return res.status(400).json({ erro: 'itemId obrigatório para concluir a conexão.' });
    }

    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    usuario.connectedBanks = usuario.connectedBanks || [];
    if (usuario.connectedBanks.find((bank) => bank.bankId === itemId)) {
        return res.status(400).json({ erro: 'Banco já conectado.' });
    }

    const item = await pluggyService.getItemDetails(itemId);
    if (!item) {
        return res.status(502).json({ erro: 'Falha ao recuperar dados da instituição financeira na Pluggy.' });
    }

    const bankName = item.connector?.name || 'Instituição financeira';
    const transactions = await carregarTransacoesPluggy(itemId, bankName);

    const bank = {
        bankId: itemId,
        bankName,
        connectedAt: new Date().toISOString(),
        lastSync: new Date().toISOString(),
        status: item.status || 'connected',
        accountType: 'Conta PJ',
        transactions
    };

    usuario.connectedBanks.push(bank);
    await salvarUsuario(usuario);
    return res.json({ sucesso: true, bank });
}

async function syncBank(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    const bank = (usuario.connectedBanks || []).find((item) => item.bankId === req.params.bankId);
    if (!bank) return res.status(404).json({ erro: 'Banco não conectado.' });

    bank.lastSync = new Date().toISOString();
    bank.transactions = await carregarTransacoesPluggy(bank.bankId, bank.bankName);
    await salvarUsuario(usuario);
    return res.json({ sucesso: true, bank });
}

async function removeBank(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    usuario.connectedBanks = (usuario.connectedBanks || []).filter((bank) => bank.bankId !== req.params.bankId);
    await salvarUsuario(usuario);
    return res.json({ sucesso: true });
}

async function tagTransaction(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    const { tag, nota } = req.body || {};
    const banks = usuario.connectedBanks || [];
    for (const bank of banks) {
        const transaction = (bank.transactions || []).find((item) => item.id === req.params.txId);
        if (transaction) {
            transaction.tag = tag || transaction.tag;
            transaction.nota = nota || transaction.nota;
            break;
        }
    }

    await salvarUsuario(usuario);
    return res.json({ sucesso: true });
}

async function conciliar(req, res) {
    const { transacoes = [], lancamentos = [] } = req.body || {};
    const conciliados = [];
    const pendentes = [];
    const usados = new Set();

    transacoes.forEach((transacao) => {
        const match = lancamentos.find((lancamento, index) => {
            if (usados.has(index)) return false;
            const valorOk = Math.abs(parseFloat(lancamento.valor) - parseFloat(transacao.valor)) < 0.01;
            const dataOk = Math.abs(new Date(lancamento.data) - new Date(transacao.data)) < 5 * 24 * 3600000;
            return valorOk && dataOk;
        });

        if (match) {
            const index = lancamentos.indexOf(match);
            usados.add(index);
            conciliados.push({ extrato: transacao, sistema: match, status: 'conciliado' });
        } else {
            pendentes.push({ extrato: transacao, status: 'pendente', motivo: 'Não encontrado' });
        }
    });

    return res.json({
        sucesso: true,
        resumo: {
            total: transacoes.length,
            conciliados: conciliados.length,
            pendentes: pendentes.length,
            percentualConciliado: transacoes.length ? Math.round((conciliados.length / transacoes.length) * 100) : 0
        },
        conciliados,
        pendentes
    });
}

async function cashflowProjection(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    const banks = usuario?.connectedBanks || [];
    const allTransactions = banks.flatMap((bank) => bank.transactions || []);
    const entradas = allTransactions.filter((item) => item.tipo === 'entrada').reduce((sum, item) => sum + Math.abs(item.valor), 0);
    const saidas = allTransactions.filter((item) => item.tipo === 'saida').reduce((sum, item) => sum + Math.abs(item.valor), 0);
    const mediaDiariaEntrada = entradas / Math.max(1, allTransactions.length / 2);
    const mediaDiariaSaida = saidas / Math.max(1, allTransactions.length / 2);
    const projecao = [];

    let saldo = entradas - saidas;
    for (let i = 1; i <= 90; i += 1) {
        const data = new Date();
        data.setDate(data.getDate() + i);
        const entrada = mediaDiariaEntrada * (0.8 + Math.random() * 0.4);
        const saida = mediaDiariaSaida * (0.7 + Math.random() * 0.6);
        saldo += entrada - saida;
        if (i % 7 === 0 || i <= 7) {
            projecao.push({
                data: data.toISOString().slice(0, 10),
                entrada: Math.round(entrada),
                saida: Math.round(saida),
                saldo: Math.round(saldo)
            });
        }
    }

    return res.json({
        sucesso: true,
        projecao,
        saldoAtual: Math.round(entradas - saidas),
        mediaEntrada: Math.round(mediaDiariaEntrada),
        mediaSaida: Math.round(mediaDiariaSaida)
    });
}

module.exports = {
    getPluggyToken,
    getBanks,
    connectBank,
    syncBank,
    removeBank,
    tagTransaction,
    conciliar,
    cashflowProjection
};
