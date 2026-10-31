const test = require('node:test');
const assert = require('node:assert/strict');
const taxEngine = require('../src/tax');

test('simulateTaxes returns traceable metadata for each embedded rule group', () => {
    const result = taxEngine.simulateTaxes({
        annualRevenue: 240000,
        margin: 0.2,
        activity: 'servicos',
        calendarYear: 2026
    });

    assert.equal(result.rules.version, 'embedded');
    assert.ok(Array.isArray(result.rules.catalog));
    assert.ok(result.rules.catalog.length >= 5);
    for (const rule of result.rules.catalog) {
        assert.ok(rule.key);
        assert.ok(rule.label);
        assert.ok(rule.source);
        assert.equal(rule.version, result.rules.version);
        assert.ok(Object.hasOwn(rule, 'effectiveFrom'));
        assert.ok(Object.hasOwn(rule, 'lastReviewedAt'));
    }
});

test('tax rule catalog distinguishes assumptions and projections', () => {
    const result = taxEngine.simulateTaxes({
        annualRevenue: 240000,
        margin: 0.2,
        activity: 'comercio',
        calendarYear: 2026
    });

    const statusByKey = Object.fromEntries(
        result.rules.catalog.map((rule) => [rule.key, rule.reviewStatus])
    );
    assert.equal(statusByKey['icms-sp'], 'assumption');
    assert.equal(statusByKey['reforma-tributaria'], 'projection');
});
