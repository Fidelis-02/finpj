(function registerSimplesNacional(root, factory) {
    const tables = typeof module === 'object' && module.exports ? require('../tables') : root.FinPJTaxTables;
    const utils = typeof module === 'object' && module.exports ? require('../utils') : root.FinPJTaxUtils;
    const api = factory(tables, utils);
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    root.FinPJTaxRegimes = root.FinPJTaxRegimes || {};
    root.FinPJTaxRegimes.simplesNacional = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildSimplesNacional(tables, utils) {
    function findBracket(annualRevenue, annex) {
        return annex.brackets.find((bracket) => annualRevenue <= bracket.upTo);
    }

    function calculateEffectiveRate(annualRevenue, bracket) {
        return ((annualRevenue * bracket.nominalRate) - bracket.deduction) / annualRevenue;
    }

    function calculate(input) {
        const activity = tables.activityTypes[input.activity];
        if (!activity || !activity.simplesAnnex) {
            return utils.buildRegimeResult(input, {
                key: 'simples',
                name: tables.regimes.simples,
                eligible: false,
                reason: 'Simples Nacional nesta versao cobre apenas comercio no Anexo I.'
            });
        }

        if (input.annualRevenue > tables.simplesNacional.maxAnnualRevenue) {
            return utils.buildRegimeResult(input, {
                key: 'simples',
                name: tables.regimes.simples,
                eligible: false,
                reason: 'Faturamento acima do limite anual do Simples Nacional.'
            });
        }

        const annex = tables.simplesNacional.annexes[activity.simplesAnnex];
        const bracket = findBracket(input.annualRevenue, annex);
        const dasEffectiveRate = calculateEffectiveRate(input.annualRevenue, bracket);
        const das = input.annualRevenue * dasEffectiveRate;
        const extraIcms = input.annualRevenue > tables.simplesNacional.icmsSublimit
            ? utils.estimateIcms(input.annualRevenue, input.margin, tables)
            : { total: 0 };
        const annualTax = das + extraIcms.total;

        return utils.buildRegimeResult(input, {
            key: 'simples',
            name: tables.regimes.simples,
            annualTax,
            breakdown: {
                das: utils.roundCurrency(das),
                icmsOutsideSublimit: utils.roundCurrency(extraIcms.total)
            },
            details: {
                annex: annex.label,
                bracket,
                dasEffectiveRate
            },
            notes: [
                'Calculo pela formula oficial: ((RBT12 x aliquota nominal) - parcela a deduzir) / RBT12.'
            ]
        });
    }

    return {
        calculate,
        calculateEffectiveRate
    };
});
