const { PluggyClient } = require('pluggy-sdk');

let pluggyClient = null;

function getConfig() {
    return {
        clientId: process.env.PLUGGY_CLIENT_ID,
        clientSecret: process.env.PLUGGY_CLIENT_SECRET
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
        userMessage: 'Nao foi possivel comunicar com a Pluggy no momento.',
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
            userMessage: 'Pluggy nao configurado no ambiente.'
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

async function getTransactions(accountId) {
    const client = getClient();
    if (!client) return [];
    try {
        const response = await client.fetchTransactions(accountId, { pageSize: 50 });
        return response.results || [];
    } catch (error) {
        console.error('Erro ao buscar transacoes da Pluggy:', error);
        return [];
    }
}

module.exports = {
    isConfigured,
    createConnectToken,
    getItemDetails,
    getAccounts,
    getTransactions
};
