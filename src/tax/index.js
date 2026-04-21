(function registerTaxEngine(root, factory) {
    const tables = typeof module === 'object' && module.exports ? require('./tables') : root.FinPJTaxTables;
    const utils = typeof module === 'object' && module.exports ? require('./utils') : root.FinPJTaxUtils;
    const simplesNacional = typeof module === 'object' && module.exports ? require('./regimes/simplesNacional') : root.FinPJTaxRegimes.simplesNacional;
    const lucroPresumido = typeof module === 'object' && module.exports ? require('./regimes/lucroPresumido') : root.FinPJTaxRegimes.lucroPresumido;
    const lucroReal = typeof module === 'object' && module.exports ? require('./regimes/lucroReal') : root.FinPJTaxRegimes.lucroReal;
    const api = factory(tables, utils, { simplesNacional, lucroPresumido, lucroReal });
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    root.FinPJTax = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTaxEngine(tables, utils, regimes) {
    function validateAndNormalizeInput(rawInput, options) {
        const input = rawInput || {};
        const annualRevenue = utils.parseNumber(input.annualRevenue ?? input.faturamento ?? input.revenue);
        const margin = utils.parseMargin(input.margin ?? input.margem);
        const activity = utils.normalizeActivity(input.activity ?? input.atividade ?? input.activityType ?? input.setor);
        const calendarYear = Number(input.calendarYear || options?.calendarYear || new Date().getFullYear());
        const errors = [];

        if (!Number.isFinite(annualRevenue) || annualRevenue <= 0) {
            errors.push('Informe um faturamento anual maior que zero.');
        }
        if (annualRevenue > 1000000000) {
            errors.push('Faturamento anual fora do intervalo suportado pelo simulador.');
        }
        if (!Number.isFinite(margin) || margin < 0 || margin > 1) {
            errors.push('Informe uma margem entre 0% e 100%.');
        }
        if (!tables.activityTypes[activity]) {
            errors.push('Informe uma atividade suportada: comercio, servicos ou industria.');
        }

        return {
            valid: errors.length === 0,
            errors,
            input: {
                annualRevenue,
                margin,
                activity,
                calendarYear
            }
        };
    }

    function simulateTaxes(rawInput, options) {
        const validation = validateAndNormalizeInput(rawInput, options);
        if (!validation.valid) {
            const error = new Error(validation.errors.join(' '));
            error.validation = validation;
            throw error;
        }

        const input = validation.input;
        const calculated = [
            regimes.simplesNacional.calculate(input),
            regimes.lucroPresumido.calculate(input),
            regimes.lucroReal.calculate(input)
        ];
        const eligible = calculated.filter((regime) => regime.eligible && Number.isFinite(regime.annualTax));
        const best = eligible.slice().sort((a, b) => a.annualTax - b.annualTax)[0] || null;
        const worst = eligible.slice().sort((a, b) => b.annualTax - a.annualTax)[0] || null;
        const worstAnnualTax = worst ? worst.annualTax : 0;
        const regimesWithSavings = calculated
            .map((regime) => ({
                ...regime,
                savingsComparedToWorst: regime.eligible
                    ? {
                        annual: utils.roundCurrency(worstAnnualTax - regime.annualTax),
                        monthly: utils.roundCurrency((worstAnnualTax - regime.annualTax) / 12)
                    }
                    : null
            }))
            .sort((a, b) => {
                if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
                if (!a.eligible) return a.name.localeCompare(b.name);
                return a.annualTax - b.annualTax;
            });

        const bestWithSavings = best
            ? regimesWithSavings.find((regime) => regime.key === best.key)
            : null;
        const worstWithSavings = worst
            ? regimesWithSavings.find((regime) => regime.key === worst.key)
            : null;

        return {
            input,
            bestRegime: bestWithSavings,
            worstRegime: worstWithSavings,
            annualTaxByRegime: regimesWithSavings.reduce((acc, regime) => {
                acc[regime.key] = regime.annualTax;
                return acc;
            }, {}),
            monthlyTaxByRegime: regimesWithSavings.reduce((acc, regime) => {
                acc[regime.key] = regime.monthlyTax;
                return acc;
            }, {}),
            effectiveRateByRegime: regimesWithSavings.reduce((acc, regime) => {
                acc[regime.key] = regime.effectiveRate;
                return acc;
            }, {}),
            savingsComparedToWorst: bestWithSavings
                ? bestWithSavings.savingsComparedToWorst
                : { annual: 0, monthly: 0 },
            regimes: regimesWithSavings,
            assumptions: tables.assumptions,
            sources: tables.sources
        };
    }

    return {
        tables,
        validateAndNormalizeInput,
        simulateTaxes
    };
});
