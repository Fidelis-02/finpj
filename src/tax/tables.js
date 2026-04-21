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
                label: 'Comercio',
                simplesAnnex: 'anexoI',
                presumidoProfile: 'commerce',
                indirectTax: 'icms'
            },
            servicos: {
                key: 'servicos',
                label: 'Servicos',
                simplesAnnex: 'anexoIII',
                presumidoProfile: 'services',
                indirectTax: 'iss'
            },
            industria: {
                key: 'industria',
                label: 'Industria',
                simplesAnnex: 'anexoII',
                presumidoProfile: 'industry',
                indirectTax: 'icms'
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
                    label: 'Anexo I - Comercio',
                    source: 'Resolucao CGSN 140/2018, art. 21 e Anexo I',
                    brackets: [
                        { upTo: 180000, nominalRate: 0.04, deduction: 0 },
                        { upTo: 360000, nominalRate: 0.073, deduction: 5940 },
                        { upTo: 720000, nominalRate: 0.095, deduction: 13860 },
                        { upTo: 1800000, nominalRate: 0.107, deduction: 22500 },
                        { upTo: 3600000, nominalRate: 0.143, deduction: 87300 },
                        { upTo: 4800000, nominalRate: 0.19, deduction: 378000 }
                    ]
                },
                anexoII: {
                    label: 'Anexo II - Industria',
                    source: 'Resolucao CGSN 140/2018, Anexo II',
                    brackets: [
                        { upTo: 180000, nominalRate: 0.045, deduction: 0 },
                        { upTo: 360000, nominalRate: 0.078, deduction: 5940 },
                        { upTo: 720000, nominalRate: 0.10, deduction: 13860 },
                        { upTo: 1800000, nominalRate: 0.112, deduction: 22500 },
                        { upTo: 3600000, nominalRate: 0.147, deduction: 85500 },
                        { upTo: 4800000, nominalRate: 0.30, deduction: 720000 }
                    ]
                },
                anexoIII: {
                    label: 'Anexo III - Servicos',
                    source: 'Resolucao CGSN 140/2018, Anexo III',
                    brackets: [
                        { upTo: 180000, nominalRate: 0.06, deduction: 0 },
                        { upTo: 360000, nominalRate: 0.112, deduction: 9360 },
                        { upTo: 720000, nominalRate: 0.135, deduction: 17640 },
                        { upTo: 1800000, nominalRate: 0.16, deduction: 35640 },
                        { upTo: 3600000, nominalRate: 0.21, deduction: 125640 },
                        { upTo: 4800000, nominalRate: 0.33, deduction: 648000 }
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
            industry: {
                irpjPresumption: 0.08,
                csllPresumption: 0.12
            },
            services: {
                irpjPresumption: 0.32,
                csllPresumption: 0.32
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
        municipalTaxes: {
            defaultIssRate: 0.05,
            source: 'LC 116/2003, limite usual de ISS ate 5%'
        },
        assumptions: [
            'RBT12 foi aproximada pelo faturamento anual informado.',
            'Servicos no Simples usam Anexo III como estimativa preliminar; o fator R pode mover parte das atividades para outro anexo.',
            'Lucro Presumido e Lucro Real incluem ICMS estimado para comercio/industria ou ISS estimado para servicos.',
            'Nao inclui substituicao tributaria, DIFAL, IPI, beneficios fiscais, retencoes, folha/pro-labore ou particularidades por UF, NCM e CNAE.'
        ],
        sources: [
            'Resolucao CGSN 140/2018, art. 21 e Anexo I',
            'Resolucao CGSN 140/2018, Anexos II e III',
            'Lei 9.249/1995 e Lei 9.430/1996 para IRPJ/CSLL',
            'Leis 9.718/1998, 10.637/2002 e 10.833/2003 para PIS/COFINS',
            'LC 224/2025 para acrescimo de 10% na presuncao sobre excedente anual',
            'RICMS/SP, art. 52, I para aliquota interna padrao de ICMS'
        ]
    };
});
