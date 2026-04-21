(function registerTaxUtils(root, factory) {
    const utils = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = utils;
    }
    root.FinPJTaxUtils = utils;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTaxUtils() {
    function parseNumber(value) {
        if (typeof value === 'number') return value;
        const raw = String(value ?? '').trim();
        if (!raw) return NaN;
        const cleaned = raw.replace(/[^\d,.-]/g, '');
        if (!cleaned) return NaN;
        const hasComma = cleaned.includes(',');
        const dotCount = (cleaned.match(/\./g) || []).length;
        const lastDotPart = cleaned.split('.').pop() || '';
        const usesDotThousands = !hasComma && dotCount > 0 && (dotCount > 1 || lastDotPart.length === 3);
        const normalized = hasComma
            ? cleaned.replace(/\./g, '').replace(',', '.')
            : usesDotThousands
                ? cleaned.replace(/\./g, '')
                : cleaned.replace(/,/g, '');
        return Number(normalized);
    }

    function parseMargin(value) {
        const parsed = parseNumber(value);
        if (!Number.isFinite(parsed)) return NaN;
        return parsed > 1 ? parsed / 100 : parsed;
    }

    function roundCurrency(value) {
        return Math.round((Number(value) || 0) * 100) / 100;
    }

    function normalizeActivity(value) {
        const normalized = String(value || 'comercio')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        if (/comerc|varejo|atacad|loja|e-?commerce|mercad/.test(normalized)) return 'comercio';
        if (/servic|consult|clin|agenc|software|profission|portal|internet|informacao|tecnolog|dados|sistema/.test(normalized)) return 'servicos';
        if (/industr|fabric|manuf/.test(normalized)) return 'industria';
        return normalized || 'comercio';
    }

    function normalizeRegime(value) {
        const normalized = String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        if (normalized.includes('simples')) return 'simples';
        if (normalized.includes('presumido')) return 'presumido';
        if (normalized.includes('real')) return 'real';
        return normalized;
    }

    function calculateIrpj(base, tables) {
        const federal = tables.federalTaxes;
        const additionalBase = Math.max(0, base - federal.irpjAdditionalAnnualThreshold);
        const baseTax = base * federal.irpjRate;
        const additionalTax = additionalBase * federal.irpjAdditionalRate;
        return {
            base: roundCurrency(base),
            baseTax: roundCurrency(baseTax),
            additionalTax: roundCurrency(additionalTax),
            total: roundCurrency(baseTax + additionalTax)
        };
    }

    function calculateCsll(base, tables) {
        const tax = base * tables.federalTaxes.csllRate;
        return {
            base: roundCurrency(base),
            total: roundCurrency(tax)
        };
    }

    function estimatePurchaseBase(annualRevenue, margin) {
        const safeMargin = Math.min(Math.max(Number(margin) || 0, 0), 1);
        return roundCurrency(annualRevenue * Math.max(0, 1 - safeMargin));
    }

    function estimateIcms(annualRevenue, margin, tables) {
        const rate = tables.stateTaxes.defaultIcmsInternalRate;
        const purchaseBase = estimatePurchaseBase(annualRevenue, margin);
        const debit = annualRevenue * rate;
        const credit = purchaseBase * rate;
        const total = Math.max(0, debit - credit);
        return {
            rate,
            debit: roundCurrency(debit),
            credit: roundCurrency(credit),
            purchaseBase,
            total: roundCurrency(total)
        };
    }

    function estimateIss(annualRevenue, tables) {
        const rate = tables.municipalTaxes.defaultIssRate;
        const total = annualRevenue * rate;
        return {
            rate,
            total: roundCurrency(total)
        };
    }

    function buildRegimeResult(input, result) {
        const annualTax = result.eligible === false ? null : roundCurrency(result.annualTax);
        return {
            key: result.key,
            name: result.name,
            eligible: result.eligible !== false,
            reason: result.reason || '',
            annualTax,
            monthlyTax: annualTax == null ? null : roundCurrency(annualTax / 12),
            effectiveRate: annualTax == null || !input.annualRevenue ? null : annualTax / input.annualRevenue,
            tax: annualTax,
            monthly: annualTax == null ? null : roundCurrency(annualTax / 12),
            breakdown: result.breakdown || {},
            details: result.details || {},
            notes: result.notes || []
        };
    }

    return {
        parseNumber,
        parseMargin,
        roundCurrency,
        normalizeActivity,
        normalizeRegime,
        calculateIrpj,
        calculateCsll,
        estimatePurchaseBase,
        estimateIcms,
        estimateIss,
        buildRegimeResult
    };
});
