(function registerLucroPresumido(root, factory) {
    const tables = typeof module === 'object' && module.exports ? require('../tables') : root.FinPJTaxTables;
    const utils = typeof module === 'object' && module.exports ? require('../utils') : root.FinPJTaxUtils;
    const api = factory(tables, utils);
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    root.FinPJTaxRegimes = root.FinPJTaxRegimes || {};
    root.FinPJTaxRegimes.lucroPresumido = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildLucroPresumido(tables, utils) {
    function applyPresumptionWithCurrentReduction(annualRevenue, presumptionRate, calendarYear, limitOverride) {
        const increase = tables.lucroPresumido.presumptiveBaseIncrease;
        const limit = limitOverride || increase.annualRevenueLimit;
        if (calendarYear < increase.effectiveFromYear || annualRevenue <= limit) {
            return annualRevenue * presumptionRate;
        }
        const regularBase = limit * presumptionRate;
        const excessBase = (annualRevenue - limit) * presumptionRate * increase.excessMultiplier;
        return regularBase + excessBase;
    }

    function calculate(input) {
        if (input.activity !== 'comercio') {
            return utils.buildRegimeResult(input, {
                key: 'presumido',
                name: tables.regimes.presumido,
                eligible: false,
                reason: 'Lucro Presumido nesta versão cobre apenas comércio.'
            });
        }

        if (input.annualRevenue > tables.lucroPresumido.maxAnnualRevenue) {
            return utils.buildRegimeResult(input, {
                key: 'presumido',
                name: tables.regimes.presumido,
                eligible: false,
                reason: 'Faturamento acima do limite usual para opção pelo Lucro Presumido.'
            });
        }

        const config = tables.lucroPresumido.commerce;
        const calendarYear = input.calendarYear;
        const csllLimit = tables.lucroPresumido.presumptiveBaseIncrease.csllAnnualRevenueLimitByYear[calendarYear]
            || tables.lucroPresumido.presumptiveBaseIncrease.annualRevenueLimit;
        const irpjBase = applyPresumptionWithCurrentReduction(input.annualRevenue, config.irpjPresumption, calendarYear);
        const csllBase = applyPresumptionWithCurrentReduction(input.annualRevenue, config.csllPresumption, calendarYear, csllLimit);
        const irpj = utils.calculateIrpj(irpjBase, tables);
        const csll = utils.calculateCsll(csllBase, tables);
        const pis = input.annualRevenue * tables.lucroPresumido.pisRate;
        const cofins = input.annualRevenue * tables.lucroPresumido.cofinsRate;
        const icms = utils.estimateIcms(input.annualRevenue, input.margin, tables);
        const annualTax = irpj.total + csll.total + pis + cofins + icms.total;

        return utils.buildRegimeResult(input, {
            key: 'presumido',
            name: tables.regimes.presumido,
            annualTax,
            breakdown: {
                irpj: irpj.total,
                irpjAdditional: irpj.additionalTax,
                csll: csll.total,
                pis: utils.roundCurrency(pis),
                cofins: utils.roundCurrency(cofins),
                icms: icms.total
            },
            details: {
                irpjBase: irpj.base,
                csllBase: csll.base,
                irpjPresumption: config.irpjPresumption,
                csllPresumption: config.csllPresumption,
                pisCofinsRate: tables.lucroPresumido.pisRate + tables.lucroPresumido.cofinsRate,
                icms
            },
            notes: [
                'IRPJ usa presunção de 8% para comércio; CSLL usa presunção de 12%.',
                'PIS/COFINS no regime cumulativo: 0,65% + 3,00% sobre receita.',
                'ICMS é estimado separadamente por não integrar IRPJ/CSLL/PIS/COFINS federais.'
            ]
        });
    }

    return {
        calculate
    };
});
