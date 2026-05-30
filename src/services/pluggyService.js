const { PluggyClient } = require('pluggy-sdk');

let pluggyClient = null;

function getConfig() {
    return {
        clientId: process.env.PLUGGY_CLIENT_ID || process.env.PLUGGY_ID || process.env.PLUGGY_CLIENT_ID_PROD,
        clientSecret: process.env.PLUGGY_CLIENT_SECRET || process.env.PLUGGY_SECRET || process.env.PLUGGY_CLIENT_SECRET_PROD
    };
}

function isConfigured() {
    const { clientId, clientSecret } = getConfig();
    return Boolean(clientId && clientSecret);
}

function getClient() {
    if (pluggyClient) return pluggyClient;

    const { clientId, clientSecret } = getConfig();
    if (!clientId || !clientSecret) {
        return null;
    }

    pluggyClient = new PluggyClient({ clientId, clientSecret });
    return pluggyClient;
}

function mapRequestError(error) {
    const detail = error?.response?.body?.message || error?.message || 'Erro desconhecido';
    return {
        detail,
        userMessage: 'A conexão bancária está temporariamente indisponível. Tente novamente mais tarde.',
        statusCode: error?.response?.statusCode || 502
    };
}

async function createConnectToken(clientUserId) {
    const client = getClient();
    if (!client) {
        return {
            ok: false,
            statusCode: 503,
            detail: 'PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET ausentes.',
            userMessage: 'A conexão bancária está temporariamente indisponível. Tente novamente mais tarde.'
        };
    }

    try {
        const token = await client.createConnectToken(undefined, {
            clientUserId,
            avoidDuplicates: true
        });
        return {
            ok: true,
            token: token.accessToken
        };
    } catch (error) {
        console.error('Erro ao gerar token da Pluggy:', error);
        return {
            ok: false,
            ...mapRequestError(error)
        };
    }
}

async function getItemDetails(itemId) {
    const client = getClient();
    if (!client) return null;
    try {
        return await client.fetchItem(itemId);
    } catch (error) {
        console.error('Erro ao buscar item da Pluggy:', error);
        return null;
    }
}

async function getAccounts(itemId) {
    const client = getClient();
    if (!client) return [];
    try {
        const response = await client.fetchAccounts(itemId);
        return response.results || [];
    } catch (error) {
        console.error('Erro ao buscar contas da Pluggy:', error);
        return [];
    }
}

/**
 * Fetch transactions for an account with pagination support.
 * @param {string} accountId - Pluggy account ID
 * @param {Object} [options] - Query options
 * @param {number} [options.pageSize=100] - Items per page (max 500)
 * @param {string} [options.from] - Start date (YYYY-MM-DD)
 * @param {string} [options.to] - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Transactions
 */
async function getTransactions(accountId, options = {}) {
    const client = getClient();
    if (!client) return [];
    try {
        const params = {
            pageSize: Math.min(options.pageSize || 100, 500)
        };
        if (options.from) params.from = options.from;
        if (options.to) params.to = options.to;

        const response = await client.fetchTransactions(accountId, params);
        const results = response.results || [];

        // Fetch additional pages if available (up to 3 pages max)
        let page = response.page || 1;
        const totalPages = response.totalPages || 1;
        const allResults = [...results];

        while (page < totalPages && page < 3) {
            page += 1;
            try {
                const nextPage = await client.fetchTransactions(accountId, { ...params, page });
                allResults.push(...(nextPage.results || []));
            } catch (e) {
                console.warn(`Pluggy: falha ao buscar página ${page}:`, e.message);
                break;
            }
        }

        return allResults;
    } catch (error) {
        console.error('Erro ao buscar transacoes da Pluggy:', error);
        return [];
    }
}

/**
 * Fetch all accounts and their transactions for a given itemId.
 * Returns normalized data ready for storage.
 * @param {string} itemId - Pluggy item ID
 * @param {Object} [options] - Options
 * @param {string} [options.from] - Start date (YYYY-MM-DD)
 * @param {string} [options.to] - End date (YYYY-MM-DD)
 * @returns {Promise<{accounts: Array, transactions: Array, summary: Object}>}
 */
async function fetchFullItemData(itemId, options = {}) {
    const accounts = await getAccounts(itemId);
    const allTransactions = [];
    const accountSummaries = [];

    for (const account of accounts) {
        const transactions = await getTransactions(account.id, options);

        const normalized = transactions.map((tx) => ({
            id: tx.id,
            accountId: account.id,
            data: String(tx.date || '').slice(0, 10),
            descricao: tx.description || tx.descriptionRaw || '',
            valor: tx.amount || 0,
            tipo: (tx.amount || 0) >= 0 ? 'entrada' : 'saida',
            categoria: tx.category || 'Outros',
            categoryId: tx.categoryId || null,
            currencyCode: tx.currencyCode || 'BRL',
            providerCode: tx.providerCode || null,
            status: tx.status || 'POSTED'
        }));

        allTransactions.push(...normalized);

        accountSummaries.push({
            id: account.id,
            name: account.name || 'Conta PJ',
            type: account.type || 'CHECKING',
            subtype: account.subtype || '',
            balance: account.balance || 0,
            currencyCode: account.currencyCode || 'BRL',
            number: account.number || '',
            transactionsCount: normalized.length
        });
    }

    const entradas = allTransactions
        .filter((tx) => tx.valor > 0)
        .reduce((sum, tx) => sum + tx.valor, 0);
    const saidas = allTransactions
        .filter((tx) => tx.valor < 0)
        .reduce((sum, tx) => sum + Math.abs(tx.valor), 0);

    return {
        accounts: accountSummaries,
        transactions: allTransactions,
        summary: {
            totalAccounts: accounts.length,
            totalTransactions: allTransactions.length,
            totalEntradas: Math.round(entradas),
            totalSaidas: Math.round(saidas),
            saldoLiquido: Math.round(entradas - saidas)
        }
    };
}

/**
 * Process a Pluggy webhook event.
 * @param {Object} event - Webhook payload from Pluggy
 * @returns {{eventType: string, itemId: string|null, action: string}}
 */
function parseWebhookEvent(event) {
    const eventType = event?.event || event?.type || '';
    const itemId = event?.itemId || event?.data?.itemId || event?.data?.id || null;

    // Pluggy sends these events:
    // - item/created
    // - item/updated
    // - item/error
    // - item/deleted
    // - connector/status_updated

    let action = 'ignore';
    if (eventType.includes('updated') || eventType.includes('created')) {
        action = 'sync';
    } else if (eventType.includes('error')) {
        action = 'mark_error';
    } else if (eventType.includes('deleted')) {
        action = 'remove';
    }

    return { eventType, itemId, action };
}

module.exports = {
    isConfigured,
    createConnectToken,
    getItemDetails,
    getAccounts,
    getTransactions,
    fetchFullItemData,
    parseWebhookEvent
};
