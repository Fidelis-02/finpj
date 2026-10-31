const CACHE_TTL_MS = Number(process.env.NEWS_CACHE_TTL_MS || 15 * 60 * 1000);
const MAX_ITEMS = Number(process.env.NEWS_MAX_ITEMS || 8);
const NEWS_API_URL = 'https://newsapi.org/v2/everything';

const TOPICS = [
    {
        category: 'Tributário',
        keywords: ['tribut', 'simples nacional', 'lucro presumido', 'lucro real', 'icms', 'iss', 'pis', 'cofins', 'darf', 'reforma'],
        opportunity: 'Revisar o enquadramento tributário e simular o impacto no próximo período.',
        cta: 'Comparar regimes',
        href: '#simulador-form-box'
    },
    {
        category: 'Financeiro',
        keywords: ['selic', 'juros', 'inflação', 'inflacao', 'crédito', 'credito', 'câmbio', 'cambio', 'inadimplência', 'inadimplencia'],
        opportunity: 'Atualizar o fluxo de caixa, o custo de capital e as projeções de recebimento.',
        cta: 'Ver impacto financeiro',
        href: '#demonstracao'
    },
    {
        category: 'Regulatório',
        keywords: ['mei', 'cnpj', 'fiscal', 'receita federal', 'gov.br', 'obrigação', 'obrigacao', 'nota fiscal', 'nf-e', 'nfe'],
        opportunity: 'Verificar obrigações, documentos e processos que podem exigir adequação.',
        cta: 'Fazer diagnóstico',
        href: '#simulador-form-box'
    },
    {
        category: 'Operações',
        keywords: ['open finance', 'pix', 'banco', 'pagamento', 'varejo', 'comércio', 'comercio', 'serviços', 'servicos'],
        opportunity: 'Usar dados bancários categorizados para identificar custos, recebíveis e desvios.',
        cta: 'Conhecer o dashboard',
        href: '#demonstracao'
    }
];

let cache = { expiresAt: 0, value: null };

function getTopic(text) {
    const normalized = String(text || '').toLocaleLowerCase('pt-BR');
    const matches = TOPICS.map((topic) => ({
        topic,
        score: topic.keywords.reduce((score, keyword) => score + (normalized.includes(keyword) ? 1 : 0), 0)
    })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
    return matches[0] || null;
}

function enrichItem(item) {
    const match = getTopic(`${item.title} ${item.summary}`);
    if (!match) return null;
    return {
        ...item,
        category: match.topic.category,
        relevance: Math.min(100, 50 + match.score * 15),
        opportunity: match.topic.opportunity,
        cta: match.topic.cta,
        href: match.topic.href
    };
}

async function fetchNewsApi() {
    if (!process.env.NEWSAPI_KEY) {
        throw new Error('NEWSAPI_KEY não configurada.');
    }

    const params = new URLSearchParams({
        q: process.env.NEWSAPI_QUERY || 'tributação OR PME OR Selic OR "Open Finance" OR crédito',
        language: process.env.NEWSAPI_LANGUAGE || 'pt',
        sortBy: 'publishedAt',
        pageSize: String(Math.max(MAX_ITEMS * 3, 20))
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.NEWS_TIMEOUT_MS || 5000));
    try {
        const response = await fetch(`${NEWS_API_URL}?${params}`, {
            headers: {
                Accept: 'application/json',
                'X-Api-Key': process.env.NEWSAPI_KEY
            },
            signal: controller.signal
        });
        const body = await response.json();
        if (!response.ok || body.status !== 'ok') {
            throw new Error(body.message || `NewsAPI respondeu HTTP ${response.status}.`);
        }
        return (body.articles || []).map((article) => ({
            title: article.title || '',
            summary: article.description || '',
            url: article.url || '',
            source: article.source?.name || 'NewsAPI',
            publishedAt: article.publishedAt || null
        })).filter((item) => item.title && item.url);
    } finally {
        clearTimeout(timeout);
    }
}

async function getDailyNews(options = {}) {
    const now = Date.now();
    if (!options.force && cache.value && cache.expiresAt > now) {
        return { ...cache.value, cached: true };
    }

    const items = await fetchNewsApi();

    const unique = new Map();
    items
        .filter((item) => !item.publishedAt || now - new Date(item.publishedAt).getTime() <= 48 * 60 * 60 * 1000)
        .map(enrichItem)
        .filter(Boolean)
        .sort((a, b) => (b.relevance - a.relevance) || (new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)))
        .forEach((item) => {
            const key = item.url || item.title.toLocaleLowerCase('pt-BR');
            if (!unique.has(key)) unique.set(key, item);
        });

    const value = {
        generatedAt: new Date().toISOString(),
        sourceCount: 1,
        items: Array.from(unique.values()).slice(0, MAX_ITEMS),
        warnings: []
    };
    cache = { value, expiresAt: now + CACHE_TTL_MS };
    return { ...value, cached: false };
}

function clearNewsCache() {
    cache = { expiresAt: 0, value: null };
}

module.exports = {
    getDailyNews,
    enrichItem,
    clearNewsCache,
};
