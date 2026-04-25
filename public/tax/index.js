(function registerTaxEngine(root, factory) {
    const tables = typeof module === 'object' && module.exports ? require('./tables') : root.FinPJTaxTables;
    const utils = typeof module === 'object' && module.exports ? require('./utils') : root.FinPJTaxUtils;
    const rbt12FatorR = typeof module === 'object' && module.exports ? require('./rbt12FatorR') : root.FinPJRbt12FatorR;
    const ncmMonofasico = typeof module === 'object' && module.exports ? require('./ncmMonofasico') : root.FinPJNcmMonofasico;
    const simplesNacional = typeof module === 'object' && module.exports ? require('./regimes/simplesNacional') : root.FinPJTaxRegimes.simplesNacional;
    const lucroPresumido = typeof module === 'object' && module.exports ? require('./regimes/lucroPresumido') : root.FinPJTaxRegimes.lucroPresumido;
    const lucroReal = typeof module === 'object' && module.exports ? require('./regimes/lucroReal') : root.FinPJTaxRegimes.lucroReal;
    const api = factory(tables, utils, { simplesNacional, lucroPresumido, lucroReal, rbt12FatorR, ncmMonofasico });
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
            errors.push('Esta versão do motor fiscal calcula apenas empresas de comércio.');
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

    /**
     * Calcula RBT12 a partir de array de faturamentos mensais
     * @param {Array} faturamentos - Array de objetos {mes, ano, valor} ou {data, valor}
     * @returns {Object} - Resultado do cálculo RBT12
     */
    function calcularRBT12(faturamentos) {
        if (regimes.rbt12FatorR) {
            return regimes.rbt12FatorR.calcularRBT12(faturamentos);
        }
        // Fallback se módulo não carregado
        return {
            rbt12: 0,
            erro: 'Módulo RBT12 não disponível',
            mesesCalculados: 0
        };
    }

    /**
     * Calcula Fator R para definir entre Anexo III e Anexo V
     * @param {Array} folhaPagamento - Array de folha de pagamento mensal
     * @param {Array} faturamentos - Array de faturamentos mensais
     * @returns {Object} - Resultado do Fator R
     */
    function calcularFatorR(folhaPagamento, faturamentos) {
        if (regimes.rbt12FatorR) {
            return regimes.rbt12FatorR.calcularFatorR(folhaPagamento, faturamentos);
        }
        return {
            fatorR: 0,
            erro: 'Módulo Fator R não disponível',
            elegivelAnexoIII: false
        };
    }

    /**
     * Índice completo de enquadramento (RBT12 + FatorR)
     * @param {Object} params - Parâmetros com faturamentos, folha e atividade
     * @returns {Object} - Índice completo
     */
    function calcularIndiceEnquadramento(params) {
        if (regimes.rbt12FatorR) {
            return regimes.rbt12FatorR.calcularIndiceEnquadramento(params);
        }
        return {
            erro: 'Módulo de enquadramento não disponível'
        };
    }

    /**
     * Verifica se NCM possui tributação monofásica
     * @param {string} ncm - Código NCM
     * @returns {Object|null} - Informações do NCM ou null
     */
    function verificarNcmMonofasico(ncm) {
        if (regimes.ncmMonofasico) {
            return regimes.ncmMonofasico.verificarNcmMonofasico(ncm);
        }
        return null;
    }

    /**
     * Calcula impacto tributário de produtos com NCM monofásico
     * @param {Array} produtos - Array de produtos com {ncm, valor, quantidade}
     * @returns {Object} - Resumo do impacto
     */
    function calcularImpactoMonofasico(produtos) {
        if (regimes.ncmMonofasico) {
            return regimes.ncmMonofasico.calcularImpactoMonofasico(produtos);
        }
        return {
            erro: 'Módulo NCM não disponível',
            produtosMonofasicos: 0,
            creditosNãoAproveitados: 0
        };
    }

    /**
     * Simulação completa com RBT12 real (não aproximado)
     * @param {Object} params - Parâmetros da simulação
     * @param {Array} params.faturamentos - Array mensal de faturamento
     * @param {Array} params.folhaPagamento - Array mensal de folha
     * @param {number} params.margin - Margem de lucro
     * @param {string} params.activity - Atividade
     * @returns {Object} - Simulação completa
     */
    function simulateWithRBT12(params) {
        const { faturamentos, folhaPagamento, margin, activity } = params || {};
        
        // Calcular RBT12 real
        const rbt12Result = calcularRBT12(faturamentos || []);
        const fatorRResult = calcularFatorR(folhaPagamento || [], faturamentos || []);
        
        // Usar RBT12 como faturamento anual para simulação
        const annualRevenue = rbt12Result.rbt12 > 0 ? rbt12Result.rbt12 : params.annualRevenue;
        
        // Definir anexo para serviços baseado no Fator R
        let effectiveActivity = utils.normalizeActivity(activity);
        let anexoSimples = 'anexoI';
        
        if (effectiveActivity === 'servicos' || effectiveActivity === 'serviços') {
            anexoSimples = fatorRResult.elegivelAnexoIII ? 'anexoIII' : 'anexoV';
        }
        
        // Executar simulação principal
        const simulation = simulateTaxes({
            annualRevenue,
            margin: utils.parseMargin(margin),
            activity: effectiveActivity
        });
        
        return {
            ...simulation,
            rbt12: rbt12Result,
            fatorR: fatorRResult,
            anexoSimples,
            isRBTCalculated: rbt12Result.rbt12 > 0,
            assumptions: [
                ...tables.assumptions,
                rbt12Result.rbt12 > 0 
                    ? `RBT12 calculado a partir de ${rbt12Result.mesesCalculados} meses de histórico.`
                    : 'RBT12 aproximado pelo faturamento anual informado.',
                effectiveActivity === 'servicos' 
                    ? `Fator R de ${(fatorRResult.fatorR * 100).toFixed(2)}% => ${anexoSimples.toUpperCase()}.`
                    : null
            ].filter(Boolean)
        };
    }

    return {
        tables,
        validateAndNormalizeInput,
        simulateTaxes,
        simulateWithRBT12,
        calcularRBT12,
        calcularFatorR,
        calcularIndiceEnquadramento,
        verificarNcmMonofasico,
        calcularImpactoMonofasico,
        utils,
        regimes: {
            simplesNacional: regimes.simplesNacional,
            lucroPresumido: regimes.lucroPresumido,
            lucroReal: regimes.lucroReal
        }
    };
});
