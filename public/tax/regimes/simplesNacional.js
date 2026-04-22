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
                reason: 'Simples Nacional nesta versão cobre apenas comércio e serviços (Anexos I, III e V).'
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

        // Para serviços, determinar Anexo baseado no Fator R (se disponível)
        let annexKey = activity.simplesAnnex;
        let fatorRInfo = null;
        
        if (input.activity === 'servicos' && activity.alternativeAnnex && input.fatorR !== undefined) {
            // Fator R >= 0.28 => Anexo III (menos tributos)
            // Fator R < 0.28 => Anexo V (mais tributos)
            if (input.fatorR < 0.28) {
                annexKey = activity.alternativeAnnex;
                fatorRInfo = { fatorR: input.fatorR, anexo: 'anexoV' };
            } else {
                fatorRInfo = { fatorR: input.fatorR, anexo: 'anexoIII' };
            }
        }

        const annex = tables.simplesNacional.annexes[annexKey];
        if (!annex) {
            return utils.buildRegimeResult(input, {
                key: 'simples',
                name: tables.regimes.simples,
                eligible: false,
                reason: `Anexo ${annexKey} não encontrado para atividade ${input.activity}.`
            });
        }

        const bracket = findBracket(input.annualRevenue, annex);
        const dasEffectiveRate = calculateEffectiveRate(input.annualRevenue, bracket);
        const das = input.annualRevenue * dasEffectiveRate;
        const extraIcms = input.annualRevenue > tables.simplesNacional.icmsSublimit
            ? utils.estimateIcms(input.annualRevenue, input.margin, tables)
            : { total: 0 };
        const annualTax = das + extraIcms.total;

        const notes = [
            'Cálculo pela fórmula oficial: ((RBT12 x alíquota nominal) - parcela a deduzir) / RBT12.'
        ];
        
        if (fatorRInfo) {
            notes.push(`Fator R de ${(fatorRInfo.fatorR * 100).toFixed(2)}% => ${annex.label}`);
        }

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
                dasEffectiveRate,
                fatorR: fatorRInfo
            },
            notes
        });
    }

    return {
        calculate,
        calculateEffectiveRate
    };
});
