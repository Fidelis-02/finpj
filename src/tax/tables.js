(function registerTaxTables(root, factory) {
    const tables = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = tables;
    }
    root.FinPJTaxTables = tables;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTaxTables() {
    return {
        activityTypes: {
            comercio: {
                key: 'comercio',
                label: 'Comércio',
                simplesAnnex: 'anexoI'
            },
            servicos: {
                key: 'servicos',
                label: 'Serviços',
                simplesAnnex: 'anexoIII',
                alternativeAnnex: 'anexoV'
            }
        },
        regimes: {
            simples: 'Simples Nacional',
            presumido: 'Lucro Presumido',
            real: 'Lucro Real'
        },
        simplesNacional: {
            maxAnnualRevenue: 4800000,
            icmsSublimit: 3600000,
            annexes: {
                anexoI: {
                    label: 'Anexo I - Comércio',
                    source: 'Resolução CGSN 140/2018, art. 21 e Anexo I',
                    brackets: [
                        { upTo: 180000, nominalRate: 0.04, deduction: 0 },
                        { upTo: 360000, nominalRate: 0.073, deduction: 5940 },
                        { upTo: 720000, nominalRate: 0.095, deduction: 13860 },
                        { upTo: 1800000, nominalRate: 0.107, deduction: 22500 },
                        { upTo: 3600000, nominalRate: 0.143, deduction: 87300 },
                        { upTo: 4800000, nominalRate: 0.19, deduction: 378000 }
                    ]
                },
                anexoIII: {
                    label: 'Anexo III - Serviços (Fator R >= 28%)',
                    source: 'Resolução CGSN 140/2018, art. 25 e Anexo III',
                    brackets: [
                        { upTo: 180000, nominalRate: 0.06, deduction: 0 },
                        { upTo: 360000, nominalRate: 0.112, deduction: 9360 },
                        { upTo: 720000, nominalRate: 0.135, deduction: 17640 },
                        { upTo: 1800000, nominalRate: 0.16, deduction: 35640 },
                        { upTo: 3600000, nominalRate: 0.21, deduction: 125640 },
                        { upTo: 4800000, nominalRate: 0.33, deduction: 648000 }
                    ]
                },
                anexoV: {
                    label: 'Anexo V - Serviços (Fator R < 28%)',
                    source: 'Resolução CGSN 140/2018, art. 26 e Anexo V',
                    brackets: [
                        { upTo: 180000, nominalRate: 0.155, deduction: 0 },
                        { upTo: 360000, nominalRate: 0.18, deduction: 4500 },
                        { upTo: 720000, nominalRate: 0.195, deduction: 9900 },
                        { upTo: 1800000, nominalRate: 0.205, deduction: 17100 },
                        { upTo: 3600000, nominalRate: 0.23, deduction: 62100 },
                        { upTo: 4800000, nominalRate: 0.305, deduction: 540000 }
                    ]
                }
            }
        },
        federalTaxes: {
            irpjRate: 0.15,
            irpjAdditionalRate: 0.10,
            irpjAdditionalAnnualThreshold: 240000,
            csllRate: 0.09
        },
        lucroPresumido: {
            maxAnnualRevenue: 78000000,
            pisRate: 0.0065,
            cofinsRate: 0.03,
            commerce: {
                irpjPresumption: 0.08,
                csllPresumption: 0.12
            },
            services: {
                irpjPresumption: 0.32,
                csllPresumption: 0.32,
                defaultIssRate: 0.05 // ISS estimado em 5%
            },
            presumptiveBaseIncrease: {
                effectiveFromYear: 2026,
                annualRevenueLimit: 5000000,
                csllAnnualRevenueLimitByYear: {
                    2026: 3750000
                },
                excessMultiplier: 1.10
            }
        },
        lucroReal: {
            pisRate: 0.0165,
            cofinsRate: 0.076,
            lossCompensationLimit: 0.30
        },
        stateTaxes: {
            defaultIcmsInternalRate: 0.18,
            defaultUf: 'SP',
            source: 'RICMS/SP, art. 52, I'
        },
        payrollTaxes: {
            cppRate: 0.20, // INSS Patronal
            ratRate: 0.02, // RAT médio
            terceirosRate: 0.058 // Terceiros
        },
        reformaTributaria: {
            // Estimativa de alíquota dual (CBS + IBS) em regime de transição/pleno
            cbsRate: 0.088,
            ibsRate: 0.177,
            // Permite desconto integral de insumos, mas folha não dá crédito
            source: 'EC 132/2023 - Reforma Tributária'
        },
        assumptions: [
            'RBT12 foi aproximada pelo faturamento anual informado.',
            'Lucro Presumido e Lucro Real incluem ICMS estimado fora do Simples, usando alíquota interna padrão de 18% e crédito sobre compras inferidas pela margem.',
            'Não inclui substituição tributária, DIFAL, IPI, benefícios fiscais, retenções, folha/pró-labore ou particularidades por UF, NCM e CNAE.'
        ],
        sources: [
            'Resolução CGSN 140/2018, art. 21 e Anexo I',
            'Lei 9.249/1995 e Lei 9.430/1996 para IRPJ/CSLL',
            'Leis 9.718/1998, 10.637/2002 e 10.833/2003 para PIS/COFINS',
            'LC 224/2025 para acréscimo de 10% na presunção sobre excedente anual',
            'RICMS/SP, art. 52, I para alíquota interna padrão de ICMS'
        ]
    };
});
