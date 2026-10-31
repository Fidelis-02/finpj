const test = require('node:test');
const assert = require('node:assert/strict');
const { getDailyNews, enrichItem, clearNewsCache } = require('../src/services/newsService');

test('enrichItem maps relevant news to a practical opportunity', () => {
    const item = enrichItem({
        title: 'Reforma tributária altera regras do Simples Nacional',
        summary: 'Empresas devem revisar seu planejamento.',
        url: 'https://example.com/reforma',
        source: 'example.com',
        publishedAt: new Date().toISOString()
    });

    assert.equal(item.category, 'Tributário');
    assert.match(item.opportunity, /enquadramento tributário/i);
    assert.equal(item.href, '#simulador-form-box');
});

test('enrichItem ignores unrelated news', () => {
    assert.equal(enrichItem({
        title: 'Resultado de campeonato esportivo',
        summary: 'Partida terminou empatada.',
        url: 'https://example.com/esporte'
    }), null);
});

test('getDailyNews requires NewsAPI credentials', async () => {
    const previousKey = process.env.NEWSAPI_KEY;
    delete process.env.NEWSAPI_KEY;
    clearNewsCache();

    await assert.rejects(
        getDailyNews({ force: true }),
        /NEWSAPI_KEY não configurada/
    );

    if (previousKey) process.env.NEWSAPI_KEY = previousKey;
});
