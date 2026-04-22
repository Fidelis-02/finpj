const taxEngine = require('../tax/index');
const taxUtils = require('../tax/utils');

const DEFAULT_TTL_MS = Number(process.env.FISCAL_CACHE_TTL_MS || 2 * 60 * 1000);
const MAX_ENTRIES = Number(process.env.FISCAL_CACHE_MAX_ENTRIES || 200);
const cache = new Map();

function normalizeInput(rawInput = {}, options = {}) {
    const annualRevenue = taxUtils.parseNumber(rawInput.annualRevenue ?? rawInput.faturamento ?? rawInput.revenue);
    const margin = taxUtils.parseMargin(rawInput.margin ?? rawInput.margem);
    const activity = taxUtils.normalizeActivity(rawInput.activity ?? rawInput.atividade ?? rawInput.activityType ?? rawInput.setor);
    const calendarYear = Number(rawInput.calendarYear || options.calendarYear || new Date().getFullYear());

    return {
        annualRevenue,
        margin,
        activity,
        calendarYear
    };
}

function buildCacheKey(input) {
    return [
        Math.round((Number(input.annualRevenue) || 0) * 100) / 100,
        Math.round((Number(input.margin) || 0) * 10000) / 10000,
        input.activity,
        input.calendarYear
    ].join(':');
}

function trimCache() {
    while (cache.size > MAX_ENTRIES) {
        const oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);
    }
}

function getFiscalSimulation(rawInput, options = {}) {
    const input = normalizeInput(rawInput, options);
    const key = buildCacheKey(input);
    const now = Date.now();
    const ttlMs = Number(options.ttlMs || DEFAULT_TTL_MS);
    const cached = cache.get(key);

    if (cached && cached.expiresAt > now) {
        return {
            simulation: cached.value,
            cached: true,
            input
        };
    }

    const simulation = taxEngine.simulateTaxes(input, { calendarYear: input.calendarYear });
    cache.set(key, {
        value: simulation,
        expiresAt: now + ttlMs
    });
    trimCache();

    return {
        simulation,
        cached: false,
        input
    };
}

function clearFiscalCache() {
    cache.clear();
}

module.exports = {
    getFiscalSimulation,
    clearFiscalCache
};
