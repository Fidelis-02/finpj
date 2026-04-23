const { obterUsuario, salvarUsuario } = require('../services/database');
const pluggyService = require('../services/pluggyService');
const { clearDashboardCache } = require('../services/dashboardService');
const {
    getScopedCompanyRecord,
    persistScopedCompanyRecord,
    ensureCompanyBanks
} = require('../services/companyContext');

function requestedCompanyId(req = {}) {
    return req.query?.companyId || req.body?.companyId || '';
}

function getScopedBankContext(usuario, companyId) {
    const scoped = getScopedCompanyRecord(usuario, companyId);
    const target = scoped.target || usuario;
    const banks = ensureCompanyBanks(target);
    return { scoped, target, banks };
}

function touchScopedCompany(usuario, scoped, target) {
    const now = new Date().toISOString();
    target.updatedAt = now;
    persistScopedCompanyRecord(usuario, scoped, target);
    usuario.updatedAt = now;
}

function gerarTransacoesMock(bankName) {
    const tipos = [
        { desc: 'PIX Recebido', tipo: 'entrada', cat: 'Receita' },
        { desc: 'PIX Enviado', tipo: 'saida', cat: 'Transferencia' },
        { desc: 'Boleto Pago', tipo: 'saida', cat: 'Fornecedor' },
        { desc: 'TED Recebida', tipo: 'entrada', cat: 'Receita' },
        { desc: 'Tarifa Bancaria', tipo: 'saida', cat: 'Taxa' },
        { desc: 'Pagamento Fornecedor', tipo: 'saida', cat: 'Fornecedor' },
        { desc: 'Recebimento Cliente', tipo: 'entrada', cat: 'Receita' },
        { desc: 'DAS Simples Nacional', tipo: 'saida', cat: 'Imposto' },
        { desc: 'Folha de Pagamento', tipo: 'saida', cat: 'RH' },
        { desc: 'Venda Cartao', tipo: 'entrada', cat: 'Receita' }
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

function flattenBankTransactions(banks = []) {
    return banks.flatMap((bank) => (bank.transactions || []).map((transaction) => ({
        ...transaction,
        bankId: bank.bankId,
        bankName: bank.bankName || 'Banco',
        companyId: bank.companyId || '',
        data: transaction.data || String(transaction.date || '').slice(0, 10),
        descricao: transaction.descricao || transaction.description || '-',
        categoria: transaction.categoria || transaction.category || 'Outros',
        valor: Number(transaction.valor ?? transaction.amount) || 0,
        tipo: transaction.tipo || (Number(transaction.valor ?? transaction.amount) >= 0 ? 'entrada' : 'saida')
    })));
}

function summarizeOpenFinance(banks = []) {
    const transactions = flattenBankTransactions(banks);
    const entradas = transactions
        .filter((item) => item.valor > 0 || item.tipo === 'entrada')
        .reduce((sum, item) => sum + Math.abs(item.valor), 0);
    const saidas = transactions
        .filter((item) => item.valor < 0 || item.tipo === 'saida')
        .reduce((sum, item) => sum + Math.abs(item.valor), 0);
    const impostos = transactions
        .filter((item) => /imposto|das|darf|tribut|fgts|inss|icms|iss|pis|cofins/i.test(`${item.categoria} ${item.descricao}`))
        .reduce((sum, item) => sum + Math.abs(item.valor), 0);
    const categories = transactions.reduce((acc, item) => {
        const key = item.categoria || 'Outros';
        const current = acc[key] || { categoria: key, entradas: 0, saidas: 0, transacoes: 0 };
        if (item.valor >= 0 || item.tipo === 'entrada') current.entradas += Math.abs(item.valor);
        else current.saidas += Math.abs(item.valor);
        current.transacoes += 1;
        acc[key] = current;
        return acc;
    }, {});
    const lastSync = banks
        .map((bank) => bank.lastSync)
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))[0] || null;

    return {
        banksCount: banks.length,
        transactionsCount: transactions.length,
        monthlyIncome: Math.round(entradas),
        monthlyExpenses: Math.round(saidas),
        bankBalance: Math.round(entradas - saidas),
        taxPaid: Math.round(impostos),
        lastSync,
        categories: Object.values(categories)
            .sort((a, b) => b.saidas + b.entradas - (a.saidas + a.entradas))
            .slice(0, 8),
        fiscalSignals: {
            importedRevenue: Math.round(entradas),
            annualizedRevenue: Math.round(entradas * 12),
            taxOutflow: Math.round(impostos),
            taxOutflowRate: entradas ? impostos / entradas : 0
        }
    };
}

async function getPluggyToken(req, res) {
    const result = await pluggyService.createConnectToken(req.userEmail);
    if (result.ok) {
        return res.json({ sucesso: true, token: result.token });
    }

    const body = {
        erro: result.userMessage || 'A conexao bancaria esta temporariamente indisponivel. Tente novamente mais tarde.'
    };
    if (process.env.NODE_ENV !== 'production' && result.detail) {
        body.detalhe = result.detail;
    }
    return res.status(result.statusCode || 500).json(body);
}

async function getBanks(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado.' });
    const { scoped, banks } = getScopedBankContext(usuario, requestedCompanyId(req));
    return res.json({ sucesso: true, companyId: scoped.snapshot?.id || null, banks });
}

async function getOpenFinanceSummary(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado.' });
    const { scoped, banks } = getScopedBankContext(usuario, requestedCompanyId(req));
    return res.json({
        sucesso: true,
        companyId: scoped.snapshot?.id || null,
        summary: summarizeOpenFinance(banks)
    });
}

async function getOpenFinanceTransactions(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado.' });
    const { scoped, banks } = getScopedBankContext(usuario, requestedCompanyId(req));
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const transactions = flattenBankTransactions(banks)
        .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0))
        .slice(0, limit);
    return res.json({ sucesso: true, companyId: scoped.snapshot?.id || null, transactions });
}

async function connectBank(req, res) {
    const { itemId } = req.body || {};
    if (!itemId) {
        return res.status(400).json({ erro: 'itemId obrigatorio para concluir a conexao.' });
    }

    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado.' });

    const { scoped, target, banks } = getScopedBankContext(usuario, requestedCompanyId(req));
    if (banks.find((bank) => bank.bankId === itemId)) {
        return res.status(400).json({ erro: 'Banco ja conectado.' });
    }

    const item = await pluggyService.getItemDetails(itemId);
    if (!item) {
        return res.status(502).json({ erro: 'Falha ao recuperar dados da instituicao financeira na Pluggy.' });
    }

    const bankName = item.connector?.name || 'Instituicao financeira';
    const transactions = await carregarTransacoesPluggy(itemId, bankName);
    const bank = {
        bankId: itemId,
        bankName,
        companyId: scoped.snapshot?.id || '',
        connectedAt: new Date().toISOString(),
        lastSync: new Date().toISOString(),
        status: item.status || 'connected',
        accountType: 'Conta PJ',
        transactions
    };

    banks.push(bank);
    touchScopedCompany(usuario, scoped, target);
    await salvarUsuario(usuario);
    clearDashboardCache();

    return res.json({ sucesso: true, companyId: scoped.snapshot?.id || null, bank });
}

async function syncBank(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado.' });

    const { scoped, target, banks } = getScopedBankContext(usuario, requestedCompanyId(req));
    const bank = banks.find((item) => item.bankId === req.params.bankId);
    if (!bank) return res.status(404).json({ erro: 'Banco nao conectado.' });

    bank.lastSync = new Date().toISOString();
    bank.transactions = await carregarTransacoesPluggy(bank.bankId, bank.bankName);
    touchScopedCompany(usuario, scoped, target);
    await salvarUsuario(usuario);
    clearDashboardCache();

    return res.json({ sucesso: true, companyId: scoped.snapshot?.id || null, bank });
}

async function removeBank(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado.' });

    const { scoped, target, banks } = getScopedBankContext(usuario, requestedCompanyId(req));
    target.connectedBanks = banks.filter((bank) => bank.bankId !== req.params.bankId);
    touchScopedCompany(usuario, scoped, target);
    await salvarUsuario(usuario);
    clearDashboardCache();

    return res.json({ sucesso: true, companyId: scoped.snapshot?.id || null });
}

async function tagTransaction(req, res) {
    const usuario = await obterUsuario(req.userEmail);
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado.' });

    const { tag, nota } = req.body || {};
    const companyId = requestedCompanyId(req);
    const contexts = companyId
        ? [getScopedBankContext(usuario, companyId)]
        : [
            getScopedBankContext(usuario, ''),
            ...(Array.isArray(usuario.empresas)
                ? usuario.empresas.map((company) => getScopedBankContext(usuario, company.id || company.cnpj || ''))
                : [])
        ];

    for (const context of contexts) {
        for (const bank of context.banks || []) {
            const transaction = (bank.transactions || []).find((item) => item.id === req.params.txId);
            if (transaction) {
                transaction.tag = tag || transaction.tag;
                transaction.nota = nota || transaction.nota;
                if (context.target && context.scoped) {
                    touchScopedCompany(usuario, context.scoped, context.target);
                } else {
                    usuario.updatedAt = new Date().toISOString();
                }
                await salvarUsuario(usuario);
                clearDashboardCache();
                return res.json({ sucesso: true });
            }
        }
    }

    return res.status(404).json({ erro: 'Transacao nao encontrada.' });
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
            pendentes.push({ extrato: transacao, status: 'pendente', motivo: 'Nao encontrado' });
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
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado.' });
    const { banks } = getScopedBankContext(usuario, requestedCompanyId(req));
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
    getOpenFinanceSummary,
    getOpenFinanceTransactions,
    connectBank,
    syncBank,
    removeBank,
    tagTransaction,
    conciliar,
    cashflowProjection
};
