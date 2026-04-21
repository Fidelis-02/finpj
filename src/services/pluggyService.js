const { PluggyClient } = require('pluggy-sdk');

let pluggyClient = null;

function getClient() {
    if (pluggyClient) return pluggyClient;
    
    const clientId = process.env.PLUGGY_CLIENT_ID;
    const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
        console.warn('Pluggy API keys not configured. Open Finance functions will use mocked data.');
        return null;
    }

    pluggyClient = new PluggyClient({
        clientId: clientId,
        clientSecret: clientSecret,
    });
    return pluggyClient;
}

/**
 * Gera um token de conexão (Connect Token) para iniciar o widget no frontend
 */
async function createConnectToken() {
    const client = getClient();
    if (!client) return null;
    try {
        const token = await client.createConnectToken();
        return token.accessToken;
    } catch (e) {
        console.error('Erro ao gerar token da Pluggy:', e);
        return null;
    }
}

/**
 * Busca detalhes de uma conta conectada (Item)
 */
async function getItemDetails(itemId) {
    const client = getClient();
    if (!client) return null;
    try {
        return await client.fetchItem(itemId);
    } catch (e) {
        console.error('Erro ao buscar item da Pluggy:', e);
        return null;
    }
}

/**
 * Busca as contas de um item (ex: Conta Corrente, Poupança)
 */
async function getAccounts(itemId) {
    const client = getClient();
    if (!client) return [];
    try {
        const response = await client.fetchAccounts(itemId);
        return response.results || [];
    } catch (e) {
        console.error('Erro ao buscar contas da Pluggy:', e);
        return [];
    }
}

/**
 * Busca as transações de uma conta
 */
async function getTransactions(accountId) {
    const client = getClient();
    if (!client) return [];
    try {
        const response = await client.fetchTransactions(accountId);
        return response.results || [];
    } catch (e) {
        console.error('Erro ao buscar transações da Pluggy:', e);
        return [];
    }
}

module.exports = {
    createConnectToken,
    getItemDetails,
    getAccounts,
    getTransactions
};
