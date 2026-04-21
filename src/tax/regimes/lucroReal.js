(function registerLucroReal(root, factory) {
    const tables = typeof module === 'object' && module.exports ? require('../tables') : root.FinPJTaxTables;
    const utils = typeof module === 'object' && module.exports ? require('../utils') : root.FinPJTaxUtils;
    const api = factory(tables, utils);
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    root.FinPJTaxRegimes = root.FinPJTaxRegimes || {};
    root.FinPJTaxRegimes.lucroReal = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildLucroReal(tables, utils) {
    function calculate(input) {
        const activity = tables.activityTypes[input.activity];
        if (!activity) {
            return utils.buildRegimeResult(input, {
                key: 'real',
                name: tables.regimes.real,
                eligible: false,
                reason: 'Atividade sem premissa configurada para Lucro Real.'
            });
        }

        const taxableProfit = Math.max(0, input.annualRevenue * input.margin);
        const irpj = utils.calculateIrpj(taxableProfit, tables);
        const csll = utils.calculateCsll(taxableProfit, tables);
        const purchaseBase = activity.indirectTax === 'iss'
            ? 0
            : utils.estimatePurchaseBase(input.annualRevenue, input.margin);
        const pisDebit = input.annualRevenue * tables.lucroReal.pisRate;
        const pisCredit = purchaseBase * tables.lucroReal.pisRate;
        const cofinsDebit = input.annualRevenue * tables.lucroReal.cofinsRate;
        const cofinsCredit = purchaseBase * tables.lucroReal.cofinsRate;
        const pis = Math.max(0, pisDebit - pisCredit);
        const cofins = Math.max(0, cofinsDebit - cofinsCredit);
        const indirectTax = activity.indirectTax === 'iss'
            ? utils.estimateIss(input.annualRevenue, tables)
            : utils.estimateIcms(input.annualRevenue, input.margin, tables);
        const annualTax = irpj.total + csll.total + pis + cofins + indirectTax.total;

        return utils.buildRegimeResult(input, {
            key: 'real',
            name: tables.regimes.real,
            annualTax,
            breakdown: {
                irpj: irpj.total,
                irpjAdditional: irpj.additionalTax,
                csll: csll.total,
                pis: utils.roundCurrency(pis),
                cofins: utils.roundCurrency(cofins),
                indirectTax: indirectTax.total
            },
            details: {
                taxableProfit: utils.roundCurrency(taxableProfit),
                purchaseBase,
                pisDebit: utils.roundCurrency(pisDebit),
                pisCredit: utils.roundCurrency(pisCredit),
                cofinsDebit: utils.roundCurrency(cofinsDebit),
                cofinsCredit: utils.roundCurrency(cofinsCredit),
                indirectTax
            },
            notes: [
                'Lucro Real simplificado: IRPJ/CSLL sobre lucro estimado pela margem informada.',
                'PIS/COFINS nao cumulativo: 1,65% + 7,60%, com credito estimado quando aplicavel.'
            ]
        });
    }

    return {
        calculate
    };
});
