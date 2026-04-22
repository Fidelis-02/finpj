(function registerRbt12FatorR(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    root.FinPJRbt12FatorR = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildRbt12FatorR() {
    /**
     * Calcula o RBT12 (Receita Bruta Total dos últimos 12 meses)
     * @param {Array} faturamentos - Array de objetos {mes, ano, valor} ou {data, valor}
     * @returns {Object} - Resultado do cálculo com rbt12 e detalhamento
     */
    function calcularRBT12(faturamentos) {
        if (!Array.isArray(faturamentos) || faturamentos.length === 0) {
            return {
                rbt12: 0,
                mesesCalculados: 0,
                mediaMensal: 0,
                meses: [],
                erro: 'Array de faturamentos vazio ou inválido'
            };
        }

        const hoje = new Date();
        const mesesUltimos12 = [];
        
        // Gerar os últimos 12 meses (incluindo o mês atual)
        for (let i = 11; i >= 0; i--) {
            const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            mesesUltimos12.push({
                ano: data.getFullYear(),
                mes: data.getMonth() + 1,
                chave: `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
            });
        }

        // Normalizar faturamentos para o formato padrão
        const faturamentosNormalizados = faturamentos.map(fat => {
            let ano, mes, valor;
            
            if (fat.data) {
                const d = new Date(fat.data);
                ano = d.getFullYear();
                mes = d.getMonth() + 1;
            } else {
                ano = fat.ano || fat.ano;
                mes = fat.mes || fat.mes;
            }
            
            valor = typeof fat.valor === 'number' ? fat.valor : 
                    typeof fat.faturamento === 'number' ? fat.faturamento : 
                    typeof fat.receita === 'number' ? fat.receita : 0;
            
            return {
                chave: `${ano}-${String(mes).padStart(2, '0')}`,
                ano,
                mes,
                valor: Math.max(0, valor)
            };
        });

        // Calcular RBT12 mês a mês
        let rbt12 = 0;
        const mesesDetalhados = mesesUltimos12.map(mesRef => {
            const faturamentoMes = faturamentosNormalizados
                .filter(f => f.chave === mesRef.chave)
                .reduce((sum, f) => sum + f.valor, 0);
            
            rbt12 += faturamentoMes;
            
            return {
                ano: mesRef.ano,
                mes: mesRef.mes,
                nomeMes: new Date(mesRef.ano, mesRef.mes - 1, 1)
                    .toLocaleString('pt-BR', { month: 'short' }),
                faturamento: faturamentoMes,
                incluido: faturamentoMes > 0
            };
        });

        const mesesComDados = mesesDetalhados.filter(m => m.incluido).length;

        return {
            rbt12: Math.round(rbt12 * 100) / 100,
            mesesCalculados: mesesComDados,
            mediaMensal: mesesComDados > 0 ? Math.round((rbt12 / mesesComDados) * 100) / 100 : 0,
            meses: mesesDetalhados,
            dataReferencia: hoje.toISOString().slice(0, 7)
        };
    }

    /**
     * Calcula o Fator R (folha de pagamento / faturamento)
     * Usado para definir entre Anexo III e Anexo V do Simples Nacional
     * @param {Array} folhaPagamento - Array de objetos {mes, ano, valor} ou {data, valor}
     * @param {Array} faturamentos - Array de objetos {mes, ano, valor} ou {data, valor}
     * @returns {Object} - Resultado do Fator R com classificação do anexo
     */
    function calcularFatorR(folhaPagamento, faturamentos) {
        // Calcular folha dos últimos 12 meses
        const hoje = new Date();
        const inicioPeriodo = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1);
        
        const folhaNormalizada = (folhaPagamento || []).map(fp => {
            let ano, mes, valor;
            
            if (fp.data) {
                const d = new Date(fp.data);
                ano = d.getFullYear();
                mes = d.getMonth() + 1;
            } else {
                ano = fp.ano || fp.ano;
                mes = fp.mes || fp.mes;
            }
            
            valor = typeof fp.valor === 'number' ? fp.valor : 
                    typeof fp.salarios === 'number' ? fp.salarios : 
                    typeof fp.prolabore === 'number' ? fp.prolabore : 0;
            
            return { ano, mes, valor: Math.max(0, valor) };
        });

        const faturamentoNormalizado = (faturamentos || []).map(fat => {
            let ano, mes, valor;
            
            if (fat.data) {
                const d = new Date(fat.data);
                ano = d.getFullYear();
                mes = d.getMonth() + 1;
            } else {
                ano = fat.ano || fat.ano;
                mes = fat.mes || fat.mes;
            }
            
            valor = typeof fat.valor === 'number' ? fat.valor : 
                    typeof fat.faturamento === 'number' ? fat.faturamento : 0;
            
            return { ano, mes, valor: Math.max(0, valor) };
        });

        // Somar folha e faturamento do período
        let totalFolha = 0;
        let totalFaturamento = 0;
        
        const mesesProcessados = [];
        
        for (let i = 11; i >= 0; i--) {
            const dataMes = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            const ano = dataMes.getFullYear();
            const mes = dataMes.getMonth() + 1;
            
            const folhaMes = folhaNormalizada
                .filter(f => f.ano === ano && f.mes === mes)
                .reduce((sum, f) => sum + f.valor, 0);
            
            const fatMes = faturamentoNormalizado
                .filter(f => f.ano === ano && f.mes === mes)
                .reduce((sum, f) => sum + f.valor, 0);
            
            totalFolha += folhaMes;
            totalFaturamento += fatMes;
            
            mesesProcessados.push({
                ano,
                mes,
                nomeMes: dataMes.toLocaleString('pt-BR', { month: 'short' }),
                folhaPagamento: folhaMes,
                faturamento: fatMes
            });
        }

        // Calcular Fator R
        const fatorR = totalFaturamento > 0 ? totalFolha / totalFaturamento : 0;
        
        // Definir anexo baseado no Fator R
        // Regra: Fator R >= 0.28 => Anexo III (menos tributos sobre serviços)
        //        Fator R < 0.28 => Anexo V (mais tributos sobre serviços)
        const anexoRecomendado = fatorR >= 0.28 ? 'anexoIII' : 'anexoV';
        const categoria = fatorR >= 0.28 ? 'Serviços com baixa carga tributária' : 'Serviços com alta carga tributária';
        
        return {
            fatorR: Math.round(fatorR * 10000) / 10000,
            fatorRPercentual: `${(fatorR * 100).toFixed(2)}%`,
            totalFolhaPagamento: Math.round(totalFolha * 100) / 100,
            totalFaturamento: Math.round(totalFaturamento * 100) / 100,
            mesesProcessados,
            anexoRecomendado,
            categoria,
            regraAplicada: fatorR >= 0.28 
                ? 'Fator R >= 28% => Anexo III (alíquotas reduzidas para serviços)'
                : 'Fator R < 28% => Anexo V (alíquotas normais para serviços)',
            elegivelAnexoIII: fatorR >= 0.28,
            periodoCalculo: {
                inicio: inicioPeriodo.toISOString().slice(0, 7),
                fim: hoje.toISOString().slice(0, 7)
            }
        };
    }

    /**
     * Função completa de enquadramento que retorna índice completo
     * @param {Object} params - Parâmetros de entrada
     * @param {Array} params.faturamentos - Array de faturamentos mensais
     * @param {Array} params.folhaPagamento - Array de folha de pagamento mensal
     * @param {string} params.atividade - Tipo de atividade (comercio, servicos, industria)
     * @returns {Object} - Índice completo de enquadramento
     */
    function calcularIndiceEnquadramento(params) {
        const { faturamentos, folhaPagamento, atividade } = params || {};
        
        const rbt12Result = calcularRBT12(faturamentos || []);
        const fatorRResult = calcularFatorR(folhaPagamento || [], faturamentos || []);
        
        // Determinar regime viável baseado no RBT12
        const limiteSimples = 4800000;
        const limitePresumido = 78000000;
        
        let regimeViavel = 'simples';
        let alertas = [];
        
        if (rbt12Result.rbt12 > limiteSimples) {
            regimeViavel = 'presumido';
            alertas.push(`RBT12 de ${rbt12Result.rbt12.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} excede o limite do Simples Nacional (${(limiteSimples).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})})`);
        }
        
        if (rbt12Result.rbt12 > limitePresumido) {
            regimeViavel = 'real';
            alertas.push(`RBT12 excede o limite recomendado para Lucro Presumido`);
        }
        
        // Para serviços, definir anexo do Simples Nacional
        let anexoSimples = 'anexoI';
        if (atividade === 'servicos' || atividade === 'serviços') {
            anexoSimples = fatorRResult.anexoRecomendado;
        }
        
        return {
            rbt12: rbt12Result,
            fatorR: fatorRResult,
            regimeViavel,
            anexoSimples,
            atividade: atividade || 'comercio',
            alertas,
            dataCalculo: new Date().toISOString(),
            simulacaoRecomendada: {
                usarRBT12: true,
                valorRBT12: rbt12Result.rbt12,
                anexoSimples: atividade === 'servicos' || atividade === 'serviços' ? anexoSimples : undefined,
                aplicarFatorR: (atividade === 'servicos' || atividade === 'serviços') && fatorRResult.fatorR > 0
            }
        };
    }

    return {
        calcularRBT12,
        calcularFatorR,
        calcularIndiceEnquadramento
    };
});
