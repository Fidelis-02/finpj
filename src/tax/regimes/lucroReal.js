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
        const isService = input.activity === 'servicos' || input.activity === 'serviços';
        if (input.activity !== 'comercio' && !isService) {
            return utils.buildRegimeResult(input, {
                key: 'real',
                name: tables.regimes.real,
                eligible: false,
                reason: 'Lucro Real nesta versão cobre apenas comércio e serviços.'
            });
        }

        const taxableProfit = Math.max(0, input.annualRevenue * input.margin);
        const irpj = utils.calculateIrpj(taxableProfit, tables);
        const csll = utils.calculateCsll(taxableProfit, tables);
        
        // PIS/COFINS Não Cumulativo
        const purchaseBase = utils.estimatePurchaseBase(input.annualRevenue, input.margin);
        const pisDebit = input.annualRevenue * tables.lucroReal.pisRate;
        const pisCredit = purchaseBase * tables.lucroReal.pisRate;
        const cofinsDebit = input.annualRevenue * tables.lucroReal.cofinsRate;
        const cofinsCredit = purchaseBase * tables.lucroReal.cofinsRate;
        const pis = Math.max(0, pisDebit - pisCredit);
        const cofins = Math.max(0, cofinsDebit - cofinsCredit);
        
        let icmsTotal = 0;
        let issTotal = 0;
        if (isService) {
            issTotal = input.annualRevenue * tables.lucroPresumido.services.defaultIssRate;
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
        const cbsCredito = purchaseBase * tables.reformaTributaria.cbsRate;
        const ibsCredito = purchaseBase * tables.reformaTributaria.ibsRate;
        const cbsTotal = (input.annualRevenue * tables.reformaTributaria.cbsRate) - cbsCredito;
        const ibsTotal = (input.annualRevenue * tables.reformaTributaria.ibsRate) - ibsCredito;
        const reformaTaxTotal = irpj.total + csll.total + cbsTotal + ibsTotal + cppTotal;

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
                taxableProfit: utils.roundCurrency(taxableProfit),
                purchaseBase,
                pisDebit: utils.roundCurrency(pisDebit),
                pisCredit: utils.roundCurrency(pisCredit),
                cofinsDebit: utils.roundCurrency(cofinsDebit),
                cofinsCredit: utils.roundCurrency(cofinsCredit)
            },
            notes: [
                'Lucro Real simplificado: IRPJ/CSLL sobre lucro estimado pela margem informada.',
                'PIS/COFINS não cumulativo: 1,65% + 7,60%, com crédito estimado sobre compras.',
                isService ? `ISS estimado para serviços.` : 'ICMS estimado separadamente.',
                input.payroll > 0 ? 'Encargos sobre a folha (CPP, RAT, Terceiros) somados ao total.' : 'Folha não informada, desconsiderando CPP patronal.',
                'Inclui projeção do IVA Dual (CBS+IBS) da Reforma Tributária (não cumulativo puro).'
            ]
        });
    }

    return {
        calculate
    };
});
