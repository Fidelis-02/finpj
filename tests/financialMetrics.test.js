const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateFinancialMetrics } = require('../src/services/financialMetrics');

test('calcula os grupos de indicadores com dados completos', () => {
    const result = calculateFinancialMetrics('balanco', {
        ativo_circulante: 100,
        disponibilidades: 20,
        estoques: 30,
        ativo_nao_circulante: 200,
        ativo_total: 300,
        passivo_circulante: 50,
        passivo_nao_circulante: 100,
        passivo_total: 150,
        patrimonio_liquido: 150,
        receita_liquida: 600,
        lucro_liquido: 30
    });

    assert.equal(result.indicadores.liquidez.liquidez_corrente, 2);
    assert.equal(result.indicadores.liquidez.liquidez_imediata, 0.4);
    assert.equal(result.indicadores.liquidez.liquidez_seca, 1.4);
    assert.equal(result.indicadores.liquidez.liquidez_geral, 2);
    assert.equal(result.indicadores.rentabilidade.roe_pct, 20);
    assert.equal(result.indicadores.rentabilidade.roa_pct, 10);
    assert.equal(result.indicadores.estrutura_capital.composicao_endividamento_pct, 33.33);
    assert.equal(result.indicadores.estrutura_capital.capital_de_giro_liquido, 50);
    assert.equal(result.indicadores.eficiencia.giro_do_ativo, 2);
});

test('não fabrica indicadores quando os campos necessários estão ausentes', () => {
    const result = calculateFinancialMetrics('balanco', {
        ativo_total: 100,
        passivo_circulante: 20,
        patrimonio_liquido: 80
    });

    assert.equal(result.indicadores.liquidez.liquidez_corrente, null);
    assert.equal(result.indicadores.liquidez.liquidez_seca, null);
    assert.equal(result.indicadores.rentabilidade.roe_pct, null);
    assert.ok(result.indicadores.limitacoes.length > 0);
    assert.equal(result.ativo_circulante, undefined);
});

test('normaliza aliases e trata denominadores zerados', () => {
    const result = calculateFinancialMetrics('dre', {
        receitaLiquida: 0,
        lucroBruto: 10,
        lucroLiquido: 5
    });
    assert.equal(result.indicadores.rentabilidade.margem_bruta_pct, null);
    assert.equal(result.indicadores.rentabilidade.margem_liquida_pct, null);

    const balance = calculateFinancialMetrics('balanco', {
        ativo_circulante: 100,
        passivo_circulante: 0,
        'ativo_não_circulante': 200
    });
    assert.equal(balance.ativo_nao_circulante, 200);
    assert.equal(balance.indicadores.liquidez.liquidez_corrente, null);
});
