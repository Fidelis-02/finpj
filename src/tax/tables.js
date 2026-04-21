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
                simplesAnnex: 'anexoI'
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
        assumptions: [
            'RBT12 foi aproximada pelo faturamento anual informado.',
            'Lucro Presumido e Lucro Real incluem ICMS estimado fora do Simples, usando aliquota interna padrao de 18% e credito sobre compras inferidas pela margem.',
            'Nao inclui substituicao tributaria, DIFAL, IPI, beneficios fiscais, retencoes, folha/pro-labore ou particularidades por UF, NCM e CNAE.'
        ],
        sources: [
            'Resolucao CGSN 140/2018, art. 21 e Anexo I',
            'Lei 9.249/1995 e Lei 9.430/1996 para IRPJ/CSLL',
            'Leis 9.718/1998, 10.637/2002 e 10.833/2003 para PIS/COFINS',
            'LC 224/2025 para acrescimo de 10% na presuncao sobre excedente anual',
            'RICMS/SP, art. 52, I para aliquota interna padrao de ICMS'
        ]
    };
});
