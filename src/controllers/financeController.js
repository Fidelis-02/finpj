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
        { desc: 'Venda Cartão', tipo: 'entrada', cat: 'Receita' },
        { desc: 'Aluguel', tipo: 'saida', cat: 'Operacional' },
        { desc: 'Energia Elétrica', tipo: 'saida', cat: 'Operacional' }
    ];
    const hoje = new Date();
    return Array.from({ length: 15 }, (_, i) => {
        const data = new Date(hoje);
        data.setDate(hoje.getDate() - i);
        const t = tipos[Math.floor(Math.random() * tipos.length)];
        const valor = Math.round((Math.random() * 18 + 0.3) * 1000);
        return {
            id: `${bankName}-${Date.now()}-${i}`,
            data: data.toISOString().slice(0, 10),
            descricao: t.desc,
            valor: t.tipo === 'entrada' ? valor : -valor,
            tipo: t.tipo,
            categoria: t.cat
        };
    });
}

async function getPluggyToken(req, res) {
    const token = await pluggyService.createConnectToken();
    if (token) {
        return res.json({ sucesso: true, token });
    }
    return res.status(500).json({ erro: 'Pluggy não configurado ou erro ao gerar token.' });
}

async function getBanks(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    res.json({ sucesso: true, banks: usuario.connectedBanks || [] });
}

async function connectBank(req, res) {
    const { itemId } = req.body;
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    if (!usuario.connectedBanks) usuario.connectedBanks = [];

    // Se houver itemId da Pluggy
    if (itemId) {
        const item = await pluggyService.getItemDetails(itemId);
        if (!item) return res.status(400).json({ erro: 'Falha ao recuperar dados da instituição financeira.' });
        
        const bankName = item.connector.name;
        if (usuario.connectedBanks.find(b => b.bankId === itemId)) {
            return res.status(400).json({ erro: 'Banco já conectado.' });
        }

        const accounts = await pluggyService.getAccounts(itemId);
        let transactions = [];
        if (accounts && accounts.length > 0) {
            // Pegar transações da primeira conta
            const txs = await pluggyService.getTransactions(accounts[0].id);
            transactions = txs.map(t => ({
                id: t.id,
                data: t.date.slice(0, 10),
                descricao: t.description,
                valor: t.amount,
                tipo: t.amount > 0 ? 'entrada' : 'saida',
                categoria: t.category || 'Outros'
            }));
        }

        const bank = {
            bankId: itemId,
            bankName,
            connectedAt: new Date().toISOString(),
            lastSync: new Date().toISOString(),
            status: item.status,
            accountType: 'Conta PJ',
            transactions: transactions.length > 0 ? transactions : gerarTransacoesMock(bankName)
        };
        usuario.connectedBanks.push(bank);
        await salvarUsuario(usuario);
        return res.json({ sucesso: true, bank });
    }

    // Fallback: modo mock antigo (se o front mandar bankId mockado)
    const { bankId, bankName } = req.body;
    if (!bankId || !bankName) return res.status(400).json({ erro: 'Banco obrigatório.' });
    if (usuario.connectedBanks.find(b => b.bankId === bankId)) {
        return res.status(400).json({ erro: 'Banco já conectado.' });
    }
    const bank = {
        bankId,
        bankName,
        connectedAt: new Date().toISOString(),
        lastSync: new Date().toISOString(),
        status: 'connected',
        accountType: 'Conta Corrente PJ',
        transactions: gerarTransacoesMock(bankName)
    };
    usuario.connectedBanks.push(bank);
    await salvarUsuario(usuario);
    res.json({ sucesso: true, bank });
}

async function syncBank(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    const bank = (usuario.connectedBanks || []).find(b => b.bankId === req.params.bankId);
    if (!bank) return res.status(404).json({ erro: 'Banco não conectado.' });
    bank.lastSync = new Date().toISOString();
    bank.transactions = gerarTransacoesMock(bank.bankName);
    await salvarUsuario(usuario);
    res.json({ sucesso: true, bank });
}

async function removeBank(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    usuario.connectedBanks = (usuario.connectedBanks || []).filter(b => b.bankId !== req.params.bankId);
    await salvarUsuario(usuario);
    res.json({ sucesso: true });
}

async function tagTransaction(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    const { tag, nota } = req.body;
    const banks = usuario.connectedBanks || [];
    for (const bank of banks) {
        const tx = (bank.transactions || []).find(t => t.id === req.params.txId);
        if (tx) { tx.tag = tag || tx.tag; tx.nota = nota || tx.nota; break; }
    }
    await salvarUsuario(usuario);
    res.json({ sucesso: true });
}

async function conciliar(req, res) {
    const { transacoes = [], lancamentos = [] } = req.body;
    const conciliados = [];
    const naoEncontrados = [];
    const usados = new Set();

    transacoes.forEach(t => {
        const match = lancamentos.find((l, i) => {
            if (usados.has(i)) return false;
            const valorOk = Math.abs(parseFloat(l.valor) - parseFloat(t.valor)) < 0.01;
            const dataOk = Math.abs(new Date(l.data) - new Date(t.data)) < 5 * 24 * 3600000;
            return valorOk && dataOk;
        });
        if (match) {
            const idx = lancamentos.indexOf(match);
            usados.add(idx);
            conciliados.push({ extrato: t, sistema: match, status: 'conciliado' });
        } else {
            naoEncontrados.push({ extrato: t, status: 'pendente', motivo: 'Não encontrado' });
        }
    });

    const resumo = {
        total: transacoes.length,
        conciliados: conciliados.length,
        pendentes: naoEncontrados.length,
        percentualConciliado: transacoes.length ? Math.round((conciliados.length / transacoes.length) * 100) : 0
    };
    res.json({ sucesso: true, resumo, conciliados, pendentes: naoEncontrados });
}

async function cashflowProjection(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    const banks = usuario?.connectedBanks || [];
    const allTx = banks.flatMap(b => b.transactions || []);
    const entradas = allTx.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Math.abs(t.valor), 0);
    const saidas = allTx.filter(t => t.tipo === 'saida').reduce((s, t) => s + Math.abs(t.valor), 0);
    const mediaDiariaE = entradas / Math.max(1, allTx.length / 2);
    const mediaDiariaS = saidas / Math.max(1, allTx.length / 2);
    const projecao = [];
    let saldo = entradas - saidas;
    for (let i = 1; i <= 90; i++) {
        const d = new Date(); d.setDate(d.getDate() + i);
        const e = mediaDiariaE * (0.8 + Math.random() * 0.4);
        const s = mediaDiariaS * (0.7 + Math.random() * 0.6);
        saldo += e - s;
        if (i % 7 === 0 || i <= 7) projecao.push({ data: d.toISOString().slice(0, 10), entrada: Math.round(e), saida: Math.round(s), saldo: Math.round(saldo) });
    }
    res.json({ sucesso: true, projecao, saldoAtual: Math.round(entradas - saidas), mediaEntrada: Math.round(mediaDiariaE), mediaSaida: Math.round(mediaDiariaS) });
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
