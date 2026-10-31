const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRss, enrichItem } = require('../src/services/newsService');

test('parseRss normalizes RSS items and decodes CDATA', () => {
    const items = parseRss(`
        <rss><channel><item>
            <title><![CDATA[Selic e crédito para PMEs]]></title>
            <link>https://example.com/noticia</link>
            <description><![CDATA[Custos de crédito podem mudar.]]></description>
            <pubDate>Sat, 31 Oct 2026 10:00:00 GMT</pubDate>
        </item></channel></rss>
    `, 'example.com');

    assert.equal(items.length, 1);
    assert.equal(items[0].title, 'Selic e crédito para PMEs');
    assert.equal(items[0].source, 'example.com');
    assert.match(items[0].publishedAt, /^2026-10-31T10:00:00/);
});

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
