function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function firstFinite(...values) {
    return values.map(finite).find((value) => value !== null) ?? null;
}

function divide(numerator, denominator) {
    if (numerator === null || denominator === null || denominator === 0) return null;
    return numerator / denominator;
}

function rounded(value, digits = 2) {
    return value === null ? null : Number(value.toFixed(digits));
}

function percentage(numerator, denominator) {
    const result = divide(numerator, denominator);
    return result === null ? null : rounded(result * 100);
}

function calculateFinancialMetrics(tipo, data = {}) {
    const limitations = [];
    if (tipo === 'dre') {
        const receitaLiquida = firstFinite(data.receita_liquida, data.receitaLiquida);
        const receitaBruta = firstFinite(data.receita_bruta, data.receitaBruta);
        const deducoes = firstFinite(data.deducoes_receita, data.deducoes);
        const cmv = firstFinite(data.cmv, data.custos);
        const lucroBruto = firstFinite(data.lucro_bruto, data.lucroBruto);
        const despesas = firstFinite(data.despesas_operacionais, data.despesasOperacionais);
        const lucroLiquido = firstFinite(data.lucro_liquido, data.lucroLiquido);
        const indicadores = {
            rentabilidade: {
                margem_bruta_pct: percentage(lucroBruto, receitaLiquida),
                margem_liquida_pct: percentage(lucroLiquido, receitaLiquida)
            }
        };
        if (lucroBruto !== null && receitaLiquida === null) limitations.push('Margem bruta requer receita líquida.');
        if (lucroLiquido !== null && receitaLiquida === null) limitations.push('Margem líquida requer receita líquida.');
        return {
            ...data,
            ...(receitaBruta !== null ? { receita_bruta: receitaBruta } : {}),
            ...(deducoes !== null ? { deducoes_receita: Math.abs(deducoes), deducoes: Math.abs(deducoes) } : {}),
            ...(cmv !== null ? { cmv: Math.abs(cmv), custos: Math.abs(cmv) } : {}),
            ...(receitaLiquida !== null ? { receita_liquida: receitaLiquida } : {}),
            ...(indicadores.rentabilidade.margem_bruta_pct !== null ? { margem_bruta_pct: indicadores.rentabilidade.margem_bruta_pct } : {}),
            ...(indicadores.rentabilidade.margem_liquida_pct !== null ? { margem_liquida_pct: indicadores.rentabilidade.margem_liquida_pct } : {}),
            indicadores: { ...indicadores, limitacoes: limitations }
        };
    }

    if (tipo !== 'balanco') return data;

    const ativoCirculante = firstFinite(data.ativo_circulante, data.ativoCirculante);
    const disponibilidades = firstFinite(data.disponibilidades, data.caixa, data.caixa_e_bancos);
    const estoques = firstFinite(data.estoques, data.estoque);
    const ativoNaoCirculante = firstFinite(data.ativo_nao_circulante, data.ativo_não_circulante, data.ativoNaoCirculante);
    const ativoTotal = firstFinite(data.ativo_total, data.ativoTotal);
    const passivoCirculante = firstFinite(data.passivo_circulante, data.passivoCirculante);
    const passivoNaoCirculante = firstFinite(data.passivo_nao_circulante, data.passivo_não_circulante, data.passivoNaoCirculante);
    const passivoTotal = firstFinite(data.passivo_total, data.passivoTotal);
    const patrimonioLiquido = firstFinite(data.patrimonio_liquido, data.patrimonioLiquido);
    const receitaLiquida = firstFinite(data.receita_liquida, data.receitaLiquida);
    const lucroLiquido = firstFinite(data.lucro_liquido, data.lucroLiquido);

    const exigivelTotal = passivoCirculante !== null && passivoNaoCirculante !== null
        ? passivoCirculante + passivoNaoCirculante
        : null;
    const indicadores = {
        liquidez: {
            liquidez_corrente: rounded(divide(ativoCirculante, passivoCirculante)),
            liquidez_imediata: rounded(divide(disponibilidades, passivoCirculante)),
            liquidez_seca: rounded(divide(
                ativoCirculante !== null && estoques !== null ? ativoCirculante - estoques : null,
                passivoCirculante
            )),
            liquidez_geral: rounded(divide(
                ativoCirculante !== null && ativoNaoCirculante !== null ? ativoCirculante + ativoNaoCirculante : null,
                exigivelTotal
            ))
        },
        rentabilidade: {
            roe_pct: percentage(lucroLiquido, patrimonioLiquido),
            roa_pct: percentage(lucroLiquido, ativoTotal)
        },
        estrutura_capital: {
            grau_endividamento: rounded(divide(exigivelTotal, patrimonioLiquido)),
            composicao_endividamento_pct: percentage(passivoCirculante, exigivelTotal),
            capital_de_giro_liquido: ativoCirculante !== null && passivoCirculante !== null
                ? rounded(ativoCirculante - passivoCirculante)
                : null
        },
        eficiencia: {
            giro_do_ativo: rounded(divide(receitaLiquida, ativoTotal)),
            giro_do_pl: rounded(divide(receitaLiquida, patrimonioLiquido))
        }
    };

    const required = [
        [indicadores.liquidez.liquidez_imediata, 'Liquidez imediata requer disponibilidades e passivo circulante.'],
        [indicadores.liquidez.liquidez_seca, 'Liquidez seca requer ativo circulante, estoques e passivo circulante.'],
        [indicadores.liquidez.liquidez_geral, 'Liquidez geral requer ativo e passivo de longo prazo.'],
        [indicadores.rentabilidade.roe_pct, 'ROE requer lucro líquido e patrimônio líquido.'],
        [indicadores.rentabilidade.roa_pct, 'ROA requer lucro líquido e ativo total.'],
        [indicadores.estrutura_capital.grau_endividamento, 'Grau de endividamento requer passivo exigível e patrimônio líquido.'],
        [indicadores.estrutura_capital.composicao_endividamento_pct, 'Composição do endividamento requer passivo circulante e passivo exigível.'],
        [indicadores.eficiencia.giro_do_ativo, 'Giro do ativo requer receita líquida e ativo total.'],
        [indicadores.eficiencia.giro_do_pl, 'Giro do patrimônio líquido requer receita líquida e patrimônio líquido.']
    ];
    required.forEach(([value, message]) => { if (value === null) limitations.push(message); });

    return {
        ...data,
        ...(ativoNaoCirculante !== null ? { ativo_nao_circulante: ativoNaoCirculante, 'ativo_não_circulante': ativoNaoCirculante } : {}),
        ...(disponibilidades !== null ? { disponibilidades } : {}),
        ...(estoques !== null ? { estoques } : {}),
        ...(passivoNaoCirculante !== null ? { passivo_nao_circulante: passivoNaoCirculante, 'passivo_não_circulante': passivoNaoCirculante } : {}),
        ...(indicadores.liquidez.liquidez_corrente !== null ? { liquidez_corrente: indicadores.liquidez.liquidez_corrente } : {}),
        ...(exigivelTotal !== null && ativoTotal !== null && ativoTotal !== 0
            ? { endividamento_pct: rounded(divide(exigivelTotal, ativoTotal)) }
            : {}),
        indicadores: { ...indicadores, limitacoes: limitations }
    };
}

module.exports = { calculateFinancialMetrics };
