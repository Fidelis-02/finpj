const DEFAULT_FEED_URL = [
    'https://news.google.com/rss/search?q=tributa%C3%A7%C3%A3o+PME+Brasil+when:2d&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    'https://news.google.com/rss/search?q=Selic+juros+empresas+Brasil+when:2d&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    'https://news.google.com/rss/search?q=regula%C3%A7%C3%A3o+fiscal+empresas+Brasil+when:2d&hl=pt-BR&gl=BR&ceid=BR:pt-419'
].join(',');
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

function decodeXml(value = '') {
    return String(value)
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
}

function stripHtml(value = '') {
    return decodeXml(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function readTag(block, tag) {
    const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return match ? decodeXml(match[1]) : '';
}

function parseRss(xml, sourceName = 'Fonte externa') {
    if (!String(xml).includes('<rss') && !String(xml).includes('<feed')) {
        throw new Error(`Resposta inválida da fonte ${sourceName}.`);
    }

    return Array.from(String(xml).matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi))
        .map((match) => {
            const block = match[1];
            const title = stripHtml(readTag(block, 'title'));
            const link = decodeXml(readTag(block, 'link')).trim();
            const publishedAt = new Date(readTag(block, 'pubDate') || readTag(block, 'published') || readTag(block, 'updated'));
            return {
                title,
                summary: stripHtml(readTag(block, 'description') || readTag(block, 'summary')),
                url: link,
                source: sourceName,
                publishedAt: Number.isNaN(publishedAt.getTime()) ? null : publishedAt.toISOString()
            };
        })
        .filter((item) => item.title && item.url);
}

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

function getFeedUrls() {
    return (process.env.NEWS_FEED_URLS || DEFAULT_FEED_URL)
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean);
}

async function fetchFeed(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.NEWS_TIMEOUT_MS || 5000));
    try {
        const response = await fetch(url, {
            headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
            signal: controller.signal
        });
        if (!response.ok) throw new Error(`Fonte respondeu HTTP ${response.status}.`);
        return await response.text();
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchNewsApi() {
    if (!process.env.NEWSAPI_KEY) return [];

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

    const feedUrls = getFeedUrls();
    const results = await Promise.allSettled(feedUrls.map(fetchFeed));
    const items = [];
    const errors = [];
    const newsApiResult = await Promise.allSettled([fetchNewsApi()]);
    if (newsApiResult[0].status === 'fulfilled') {
        items.push(...newsApiResult[0].value);
    } else if (process.env.NEWSAPI_KEY) {
        errors.push({ source: 'NewsAPI', message: newsApiResult[0].reason?.message || 'Falha ao consultar NewsAPI.' });
    }
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            errors.push({ source: feedUrls[index], message: result.reason?.message || 'Falha ao consultar fonte.' });
            return;
        }
        try {
            items.push(...parseRss(result.value, new URL(feedUrls[index]).hostname));
        } catch (error) {
            errors.push({ source: feedUrls[index], message: error.message });
        }
    });

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

    const configuredSources = feedUrls.length + (process.env.NEWSAPI_KEY ? 1 : 0);
    if (!unique.size && errors.length === configuredSources) {
        throw new Error('Nenhuma fonte de notícias está disponível no momento.');
    }

    const value = {
        generatedAt: new Date().toISOString(),
        sourceCount: configuredSources - errors.length,
        items: Array.from(unique.values()).slice(0, MAX_ITEMS),
        warnings: errors
    };
    cache = { value, expiresAt: now + CACHE_TTL_MS };
    return { ...value, cached: false };
}

function clearNewsCache() {
    cache = { expiresAt: 0, value: null };
}

module.exports = {
    getDailyNews,
    parseRss,
    enrichItem,
    clearNewsCache,
    DEFAULT_FEED_URL
};
