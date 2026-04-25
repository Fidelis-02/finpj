(function registerNcmMonofasico(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    root.FinPJNcmMonofasico = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildNcmMonofasico() {
    /**
     * Banco de dados de NCMs com tributação monofásica de PIS/COFINS
     * Fonte: Leis 10.637/2002 e 10.833/2003 - atualizadas até 2026
     * 
     * A tributação monofásica significa que o imposto é pago em uma única etapa
     * (geralmente na saída da indústria/distribuidor), e não há crédito nem débito
     * nas operações subsequentes.
     */
    const ncmsMonofasicos = {
        // ==================== BEBIDAS ====================
        bebidas: {
            descricao: 'Bebidas alcoólicas, refrigerantes, águas e outras bebidas não alcoólicas',
            aliquotas: {
                pis: 0.0165,      // 1,65% - mas sem crédito/débito na cadeia
                cofins: 0.076,    // 7,60% - mas sem crédito/débito na cadeia
                total: 0.0925     // 9,25% total
            },
            ncms: [
                { codigo: '2201.00.00', descricao: 'Águas, incluídas as águas minerais e gasificadas, adicionadas de açúcar ou de outros edulcorantes ou aromatizadas' },
                { codigo: '2202.10.00', descricao: 'Refrigerantes, água gaseificada com adição de açúcar ou aromatizantes' },
                { codigo: '2202.90.00', descricao: 'Outras bebidas não alcoólicas (exceto sucos)' },
                { codigo: '2203.00.00', descricao: 'Cerveja de malte' },
                { codigo: '2204.10.10', descricao: 'Vinhos espumantes (champanhes)' },
                { codigo: '2204.10.90', descricao: 'Outros vinhos espumantes' },
                { codigo: '2204.21.00', descricao: 'Vinhos em recipientes de capacidade inferior a 2 litros' },
                { codigo: '2204.22.00', descricao: 'Vinhos em recipientes de capacidade superior ou igual a 2 litros' },
                { codigo: '2204.29.00', descricao: 'Outros vinhos de uvas frescas' },
                { codigo: '2204.30.00', descricao: 'Mostos de uvas (mosto de uva em processo de fermentação)' },
                { codigo: '2205.10.00', descricao: 'Vermutes e outros vinhos de uvas frescas preparados com plantas ou substâncias aromáticas' },
                { codigo: '2205.90.00', descricao: 'Outros vermutes' },
                { codigo: '2206.00.11', descricao: 'Sidra (cerveja de maçã) e outras bebidas fermentadas' },
                { codigo: '2206.00.19', descricao: 'Outras bebidas fermentadas' },
                { codigo: '2206.00.21', descricao: 'Outras bebidas fermentadas de base de frutas' },
                { codigo: '2206.00.29', descricao: 'Outras bebidas fermentadas não especificadas' },
                { codigo: '2206.00.90', descricao: 'Outras bebidas fermentadas diversas' },
                { codigo: '2208.20.00', descricao: 'Aguardente de vinho (pisco, grappa, bagaceira)' },
                { codigo: '2208.30.00', descricao: 'Whiskies' },
                { codigo: '2208.40.00', descricao: 'Ron (rum) e tafia' },
                { codigo: '2208.50.00', descricao: 'Gim (gin) e genebra' },
                { codigo: '2208.60.00', descricao: 'Vodka' },
                { codigo: '2208.70.00', descricao: 'Licores e destilados de frutas' },
                { codigo: '2208.90.00', descricao: 'Outras bebidas destiladas' }
            ]
        },

        // ==================== AUTOPEÇAS ====================
        autopecas: {
            descricao: 'Autopeças e componentes automotivos com tributação especial',
            aliquotas: {
                pis: 0.0065,      // 0,65% - regime cumulativo especial
                cofins: 0.03,     // 3,00% - regime cumulativo especial
                total: 0.0365     // 3,65% total
            },
            observacao: 'Setor automotivo possui alíquotas específicas do regime cumulativo',
            ncms: [
                { codigo: '8407.31.10', descricao: 'Motores de explosão, pistão, de ignição por centelha (velas) para automóveis' },
                { codigo: '8407.33.10', descricao: 'Motores de explosão, pistão, de ignição por centelha para caminhões' },
                { codigo: '8408.20.11', descricao: 'Motores de diesel ou semidiesel para automóveis' },
                { codigo: '8408.20.19', descricao: 'Outros motores de diesel ou semidiesel' },
                { codigo: '8409.91.00', descricao: 'Partes para motores das posições 8407 ou 8408' },
                { codigo: '8409.99.00', descricao: 'Outras partes para motores' },
                { codigo: '8413.30.10', descricao: 'Bombas de combustível para motores de ignição por centelha' },
                { codigo: '8414.10.00', descricao: 'Bombas de vácuo' },
                { codigo: '8414.59.00', descricao: 'Outras ventoinhas e circuladores de ar' },
                { codigo: '8479.89.00', descricao: 'Outras máquinas e aparelhos mecânicos com função própria' },
                { codigo: '8481.30.00', descricao: 'Válvulas de alívio ou de retenção' },
                { codigo: '8481.80.00', descricao: 'Outras torneiras, válvulas e dispositivos semelhantes' },
                { codigo: '8482.10.00', descricao: 'Rolamentos de esferas' },
                { codigo: '8482.20.00', descricao: 'Rolamentos de rolos cilíndricos' },
                { codigo: '8482.30.00', descricao: 'Rolamentos de rolos esféricos' },
                { codigo: '8483.10.00', descricao: 'Árvores de transmissão e manivelas' },
                { codigo: '8483.20.00', descricao: 'Caixas de engrenagens e outros variadores de velocidade' },
                { codigo: '8483.50.00', descricao: 'Engrenagens e rodas de fricção' },
                { codigo: '8501.10.20', descricao: 'Motores elétricos de potência inferior a 37,5W' },
                { codigo: '8501.20.00', descricao: 'Motores elétricos de corrente universal' },
                { codigo: '8501.31.10', descricao: 'Motores elétricos de corrente contínua, de potência inferior a 750W' },
                { codigo: '8504.40.10', descricao: 'Fontes de alimentação para motores de ignição' },
                { codigo: '8511.10.10', descricao: 'Aparelhos de ignição de motores' },
                { codigo: '8511.20.00', descricao: 'Aparelhos de corte para magnetos e volantes de inércia' },
                { codigo: '8511.30.00', descricao: 'Distribuidores e bobinas de ignição' },
                { codigo: '8511.40.00', descricao: 'Motor de arranque (partida)' },
                { codigo: '8511.50.00', descricao: 'Outros geradores e alternadores' },
                { codigo: '8511.80.00', descricao: 'Outros aparelhos elétricos de ignição ou de arranque' },
                { codigo: '8511.90.00', descricao: 'Partes dos aparelhos elétricos de ignição ou de arranque' },
                { codigo: '8512.20.10', descricao: 'Aparelhos de iluminação ou de sinalização' },
                { codigo: '8512.40.00', descricao: 'Aparelhos de iluminação de advertência de emergência' },
                { codigo: '8512.90.10', descricao: 'Partes de aparelhos de iluminação ou sinalização' },
                { codigo: '8708.10.00', descricao: 'Para-choques e suas partes' },
                { codigo: '8708.21.00', descricao: 'Carrocerias para veículos' },
                { codigo: '8708.29.00', descricao: 'Outras partes de carrocerias' },
                { codigo: '8708.30.00', descricao: 'Freios e servo-freios e suas partes' },
                { codigo: '8708.40.00', descricao: 'Caixas de engrenagens e suas partes' },
                { codigo: '8708.50.00', descricao: 'Rodas de transmissão e suas partes' },
                { codigo: '8708.70.00', descricao: 'Rodas e peças de rodas' },
                { codigo: '8708.80.00', descricao: 'Amortecedores de suspensão e suas partes' },
                { codigo: '8708.91.00', descricao: 'Outras partes de radiadores' },
                { codigo: '8708.92.00', descricao: 'Silenciosos (escapes) e suas partes' },
                { codigo: '8708.93.00', descricao: 'Embraiagens e suas partes' },
                { codigo: '8708.94.00', descricao: 'Volantes, direções e colunas de direção' },
                { codigo: '8708.95.00', descricao: 'Airbags e suas partes' },
                { codigo: '8708.99.00', descricao: 'Outras partes e acessórios de veículos' }
            ]
        },

        // ==================== PERFUMARIA ====================
        perfumaria: {
            descricao: 'Produtos de perfumaria, higiene pessoal e cosméticos',
            aliquotas: {
                pis: 0.0165,      // 1,65%
                cofins: 0.076,    // 7,60%
                total: 0.0925     // 9,25% total
            },
            ncms: [
                { codigo: '3303.00.10', descricao: 'Perfumes e águas de toilette' },
                { codigo: '3303.00.20', descricao: 'Outras preparações odoríferas' },
                { codigo: '3303.00.90', descricao: 'Outras preparações para perfumar ou desodorizar' },
                { codigo: '3304.10.00', descricao: 'Preparações para barbear (pós-barba, loções)' },
                { codigo: '3304.20.00', descricao: 'Preparações para cuidado da pele (cremes, loções)' },
                { codigo: '3304.30.00', descricao: 'Preparações para manicures e pedicures' },
                { codigo: '3304.91.00', descricao: 'Pós de beleza, maquilagem e preparações semelhantes' },
                { codigo: '3304.99.00', descricao: 'Outras preparações para cuidados corporais' },
                { codigo: '3305.10.00', descricao: 'Xampus (shampoos)' },
                { codigo: '3305.20.00', descricao: 'Preparações para ondulação ou alisamento de cabelo' },
                { codigo: '3305.30.00', descricao: 'Laca para cabelo' },
                { codigo: '3305.90.00', descricao: 'Outras preparações capilares' },
                { codigo: '3306.10.00', descricao: 'Dentifícios (cremes dentais)' },
                { codigo: '3306.20.00', descricao: 'Fio dental (sedas dentárias)' },
                { codigo: '3306.90.00', descricao: 'Outras preparações para higiene bucal' },
                { codigo: '3307.10.00', descricao: 'Preparações para barbear' },
                { codigo: '3307.20.00', descricao: 'Desodorantes corporais' },
                { codigo: '3307.30.00', descricao: 'Sais de banho' },
                { codigo: '3307.41.00', descricao: 'Outras preparações odoríferas' },
                { codigo: '3307.49.00', descricao: 'Outras preparações para higiene' },
                { codigo: '3307.90.00', descricao: 'Outras preparações para higiene pessoal' }
            ]
        },

        // ==================== PETRÓLEO E COMBUSTÍVEIS ====================
        combustiveis: {
            descricao: 'Petróleo, combustíveis e lubrificantes',
            aliquotas: {
                pis: 0.0165,
                cofins: 0.076,
                total: 0.0925
            },
            observacao: 'Tributação monofásica via PIS/PASEP e COFINS de importação/ produção',
            ncms: [
                { codigo: '2709.00.00', descricao: 'Petróleos brutos' },
                { codigo: '2710.12.10', descricao: 'Gasolina de aviação' },
                { codigo: '2710.12.20', descricao: 'Gasolina para motores (gasolina automotiva)' },
                { codigo: '2710.12.30', descricao: 'Gasolina para motores com aditivo' },
                { codigo: '2710.12.90', descricao: 'Outras gasolinas' },
                { codigo: '2710.19.10', descricao: 'Querosene de aviação' },
                { codigo: '2710.19.20', descricao: 'Querosene iluminante' },
                { codigo: '2710.19.90', descricao: 'Outros petróleos leves' },
                { codigo: '2710.20.00', descricao: 'Óleo diesel (diesel fuel)' },
                { codigo: '2710.91.00', descricao: 'Resíduos de petróleo' },
                { codigo: '2710.99.00', descricao: 'Outros óleos de petróleo' },
                { codigo: '2711.11.00', descricao: 'Gás natural liquefeito' },
                { codigo: '2711.12.00', descricao: 'Propano liquefeito' },
                { codigo: '2711.13.00', descricao: 'Butanos liquefeitos' },
                { codigo: '2711.19.00', descricao: 'Outros gases de petróleo liquefeitos' },
                { codigo: '2711.21.00', descricao: 'Gás natural em estado gasoso' },
                { codigo: '2711.29.00', descricao: 'Outros gases de petróleo' },
                { codigo: '2712.10.00', descricao: 'Vaselina (petrolatum)' },
                { codigo: '2712.20.00', descricao: 'Parafina' },
                { codigo: '2712.90.00', descricao: 'Outros resíduos de petróleo' }
            ]
        },

        // ==================== CIGARROS ====================
        cigarros: {
            descricao: 'Cigarros e produtos do tabaco',
            aliquotas: {
                pis: 0.0165,
                cofins: 0.076,
                total: 0.0925
            },
            observacao: 'Tributação monofásica com controle especial',
            ncms: [
                { codigo: '2401.10.00', descricao: 'Cigarros contendo tabaco' },
                { codigo: '2401.20.00', descricao: 'Outros cigarros contendo tabaco' },
                { codigo: '2401.30.00', descricao: 'Tabaco para cachimbo' },
                { codigo: '2402.10.00', descricao: 'Charutos, cheroots e cigarros de folha' },
                { codigo: '2402.20.00', descricao: 'Cigarros contendo tabaco' },
                { codigo: '2402.90.00', descricao: 'Outros tabacos e sucedâneos' },
                { codigo: '2403.11.00', descricao: 'Tabaco para fumar, não manufaturado' },
                { codigo: '2403.19.00', descricao: 'Outros tabacos para fumar' },
                { codigo: '2403.91.00', descricao: 'Tabaco para fumar, manufaturado' },
                { codigo: '2403.99.00', descricao: 'Outros tabacos manufaturados' }
            ]
        },

        // ==================== ADOÇANTES ====================
        adocantes: {
            descricao: 'Adoçantes sintéticos e edulcorantes',
            aliquotas: {
                pis: 0.0165,
                cofins: 0.076,
                total: 0.0925
            },
            ncms: [
                { codigo: '2924.29.10', descricao: 'Sacarina e seus sais' },
                { codigo: '2936.29.10', descricao: 'Outros edulcorantes sintéticos' }
            ]
        }
    };

    /**
     * Verifica se um NCM possui tributação monofásica
     * @param {string} ncm - Código NCM (com ou sem pontos)
     * @returns {Object|null} - Informações do NCM ou null se não for monofásico
     */
    function verificarNcmMonofasico(ncm) {
        if (!ncm) return null;
        
        // Normalizar NCM (remover pontos e espaços)
        const ncmLimpo = String(ncm).replace(/[.\s]/g, '').trim();
        const ncmFormatado = formatarNcm(ncmLimpo);
        
        // Verificar em todas as categorias
        for (const [categoria, dados] of Object.entries(ncmsMonofasicos)) {
            const encontrado = dados.ncms.find(n => {
                const codigoLimpo = n.codigo.replace(/[.\s]/g, '');
                // Verificar correspondência exata ou se o NCM começa com o código
                return ncmLimpo === codigoLimpo || ncmLimpo.startsWith(codigoLimpo);
            });
            
            if (encontrado) {
                return {
                    codigo: encontrado.codigo,
                    codigoLimpo: encontrado.codigo.replace(/[.\s]/g, ''),
                    descricao: encontrado.descricao,
                    categoria,
                    categoriaDescricao: dados.descricao,
                    aliquotas: dados.aliquotas,
                    observacao: dados.observacao || null,
                    isMonofasico: true,
                    impactoTributario: 'Não gera crédito nem débito de PIS/COFINS nas operações'
                };
            }
        }
        
        return null;
    }

    /**
     * Formata o NCM para o padrão XXXX.XX.XX
     * @param {string} ncm - Código NCM limpo
     * @returns {string} - NCM formatado
     */
    function formatarNcm(ncm) {
        const limpo = String(ncm).replace(/\D/g, '').padStart(8, '0');
        return `${limpo.slice(0, 4)}.${limpo.slice(4, 6)}.${limpo.slice(6, 8)}`;
    }

    /**
     * Calcula o impacto tributário de uma lista de produtos com NCM
     * @param {Array} produtos - Array de {ncm, valor, quantidade}
     * @returns {Object} - Resumo do impacto tributário
     */
    function calcularImpactoMonofasico(produtos) {
        if (!Array.isArray(produtos) || produtos.length === 0) {
            return {
                totalProdutos: 0,
                produtosMonofasicos: 0,
                valorMonofasico: 0,
                percentualMonofasico: 0,
                creditosNãoAproveitados: 0,
                detalhamento: [],
                alertas: []
            };
        }

        let valorTotal = 0;
        let valorMonofasico = 0;
        let produtosMonofasicos = 0;
        const detalhamento = [];
        const alertas = [];

        for (const produto of produtos) {
            const valor = (produto.valor || 0) * (produto.quantidade || 1);
            valorTotal += valor;
            
            const ncmInfo = verificarNcmMonofasico(produto.ncm);
            
            if (ncmInfo) {
                produtosMonofasicos++;
                valorMonofasico += valor;
                
                // Calcular créditos que não serão aproveitados (se fosse não-cumulativo)
                const creditosNãoAproveitados = valor * ncmInfo.aliquotas.total;
                
                detalhamento.push({
                    ncm: produto.ncm,
                    descricao: produto.descricao || ncmInfo.descricao,
                    valor,
                    isMonofasico: true,
                    categoria: ncmInfo.categoria,
                    aliquotaTotal: ncmInfo.aliquotas.total,
                    creditosNãoAproveitados: Math.round(creditosNãoAproveitados * 100) / 100
                });
            } else {
                detalhamento.push({
                    ncm: produto.ncm,
                    descricao: produto.descricao || 'Produto não catalogado',
                    valor,
                    isMonofasico: false,
                    categoria: null,
                    aliquotaTotal: 0,
                    creditosNãoAproveitados: 0
                });
            }
        }

        const percentualMonofasico = valorTotal > 0 ? (valorMonofasico / valorTotal) : 0;
        const creditosNãoAproveitados = detalhamento
            .filter(d => d.isMonofasico)
            .reduce((sum, d) => sum + d.creditosNãoAproveitados, 0);

        // Gerar alertas
        if (percentualMonofasico > 0.5) {
            alertas.push(`Mais de 50% do faturamento (${(percentualMonofasico * 100).toFixed(1)}%) é de produtos monofásicos. Considere revisar o regime tributário.`);
        }
        
        if (produtosMonofasicos > 0 && creditosNãoAproveitados > 10000) {
            alertas.push(`Créditos de PIS/COFINS não aproveitados estimados em R$ ${creditosNãoAproveitados.toLocaleString('pt-BR', {minimumFractionDigits: 2})}. Análise a viabilidade do regime.`);
        }

        return {
            totalProdutos: produtos.length,
            produtosMonofasicos,
            valorTotal: Math.round(valorTotal * 100) / 100,
            valorMonofasico: Math.round(valorMonofasico * 100) / 100,
            percentualMonofasico: Math.round(percentualMonofasico * 10000) / 10000,
            creditosNãoAproveitados: Math.round(creditosNãoAproveitados * 100) / 100,
            detalhamento,
            alertas,
            recomendacao: percentualMonofasico > 0.3 
                ? 'Alta incidência de produtos monofásicos. Avalie migração para regime mais adequado.'
                : 'Percentual de monofásicos dentro da normalidade.'
        };
    }

    /**
     * Retorna todos os NCMs monofásicos catalogados
     * @returns {Object} - Estrutura completa do banco de dados
     */
    function obterTodosNcms() {
        return {
            ...ncmsMonofasicos,
            totalCategorias: Object.keys(ncmsMonofasicos).length,
            totalNcms: Object.values(ncmsMonofasicos).reduce((sum, cat) => sum + cat.ncms.length, 0)
        };
    }

    /**
     * Busca NCMs por categoria
     * @param {string} categoria - Nome da categoria
     * @returns {Object|null} - Dados da categoria ou null
     */
    function buscarPorCategoria(categoria) {
        const dados = ncmsMonofasicos[categoria.toLowerCase()];
        if (!dados) return null;
        
        return {
            categoria,
            ...dados,
            quantidade: dados.ncms.length
        };
    }

    /**
     * Exporta os dados para formato JSON (útil para persistência)
     * @returns {string} - JSON string
     */
    function exportarJson() {
        return JSON.stringify(ncmsMonofasicos, null, 2);
    }

    return {
        verificarNcmMonofasico,
        calcularImpactoMonofasico,
        obterTodosNcms,
        buscarPorCategoria,
        formatarNcm,
        exportarJson,
        categorias: Object.keys(ncmsMonofasicos),
        dados: ncmsMonofasicos
    };
});
