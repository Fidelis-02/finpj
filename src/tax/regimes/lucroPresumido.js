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
        const isService = input.activity === 'servicos' || input.activity === 'serviços';
        if (input.activity !== 'comercio' && !isService) {
            return utils.buildRegimeResult(input, {
                key: 'presumido',
                name: tables.regimes.presumido,
                eligible: false,
                reason: 'Lucro Presumido nesta versão cobre apenas comércio e serviços.'
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

        const config = isService ? tables.lucroPresumido.services : tables.lucroPresumido.commerce;
        const calendarYear = input.calendarYear || new Date().getFullYear();
        const csllLimit = tables.lucroPresumido.presumptiveBaseIncrease.csllAnnualRevenueLimitByYear[calendarYear]
            || tables.lucroPresumido.presumptiveBaseIncrease.annualRevenueLimit;
        
        const irpjBase = applyPresumptionWithCurrentReduction(input.annualRevenue, config.irpjPresumption, calendarYear);
        const csllBase = applyPresumptionWithCurrentReduction(input.annualRevenue, config.csllPresumption, calendarYear, csllLimit);
        
        const irpj = utils.calculateIrpj(irpjBase, tables);
        const csll = utils.calculateCsll(csllBase, tables);
        const pis = input.annualRevenue * tables.lucroPresumido.pisRate;
        const cofins = input.annualRevenue * tables.lucroPresumido.cofinsRate;
        
        let icmsTotal = 0;
        let issTotal = 0;
        if (isService) {
            issTotal = input.annualRevenue * config.defaultIssRate;
        } else {
            icmsTotal = utils.estimateIcms(input.annualRevenue, input.margin, tables).total;
        }

        // Encargos sobre folha (CPP)
        let cppTotal = 0;
        if (input.payroll > 0) {
            cppTotal = input.payroll * (tables.payrollTaxes.cppRate + tables.payrollTaxes.ratRate + tables.payrollTaxes.terceirosRate);
        }

        const annualTax = irpj.total + csll.total + pis + cofins + icmsTotal + issTotal + cppTotal;

        // Projeção Reforma Tributária (Substituição de PIS/COFINS/ICMS/ISS por CBS/IBS)
        const comprasInsumos = input.annualRevenue * (1 - input.margin) * 0.5; // Estimativa de compras com crédito (50% do custo)
        const cbsCredito = comprasInsumos * tables.reformaTributaria.cbsRate;
        const ibsCredito = comprasInsumos * tables.reformaTributaria.ibsRate;
        const cbsTotal = (input.annualRevenue * tables.reformaTributaria.cbsRate) - cbsCredito;
        const ibsTotal = (input.annualRevenue * tables.reformaTributaria.ibsRate) - ibsCredito;
        const reformaTaxTotal = irpj.total + csll.total + cbsTotal + ibsTotal + cppTotal;

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
                icms: utils.roundCurrency(icmsTotal),
                iss: utils.roundCurrency(issTotal),
                cpp: utils.roundCurrency(cppTotal)
            },
            reformaTributaria: {
                annualTax: utils.roundCurrency(reformaTaxTotal),
                cbs: utils.roundCurrency(cbsTotal),
                ibs: utils.roundCurrency(ibsTotal),
                economiaVsAtual: utils.roundCurrency(annualTax - reformaTaxTotal)
            },
            details: {
                irpjBase: irpj.base,
                csllBase: csll.base,
                irpjPresumption: config.irpjPresumption,
                csllPresumption: config.csllPresumption,
                pisCofinsRate: tables.lucroPresumido.pisRate + tables.lucroPresumido.cofinsRate
            },
            notes: [
                `IRPJ usa presunção de ${config.irpjPresumption * 100}%; CSLL usa presunção de ${config.csllPresumption * 100}%.`,
                'PIS/COFINS no regime cumulativo: 0,65% + 3,00% sobre receita.',
                isService ? `ISS estimado em ${config.defaultIssRate * 100}% para serviços.` : 'ICMS estimado separadamente por não integrar federais.',
                input.payroll > 0 ? 'Encargos sobre a folha (CPP, RAT, Terceiros) somados ao total.' : 'Folha não informada, desconsiderando CPP patronal.',
                'Inclui projeção do IVA Dual (CBS+IBS) da Reforma Tributária.'
            ]
        });
    }

    return {
        calculate
    };
});
