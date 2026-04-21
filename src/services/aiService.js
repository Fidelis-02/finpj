function fmtReais(valor) {
    return 'R$ ' + Math.round(Number(valor) || 0).toLocaleString('pt-BR');
}

function sanitizeText(input, maxLen = 12000) {
    if (!input) return '';
    let s = String(input);
    // Remove control characters and collapse whitespace
    s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
    s = s.replace(/\s+/g, ' ');
    return s.slice(0, maxLen).trim();
}

function gerarAnaliseInterna(diagnostico) {
    const { faturamento, margem, regime, setor, resultados } = diagnostico;
    const economia = resultados.economia || 0;
    const creditos = resultados.creditosIdentificados || 0;
    const anomalia = resultados.anomaliaValor || 0;
    const percentualEconomia = faturamento > 0 ? Math.round((economia / faturamento) * 100) : 0;

    const recomendacoes = [];
    recomendacoes.push(`Revisar o regime tributário: o regime ideal apontado é ${resultados.regimeIdeal}.`);
    if (percentualEconomia >= 8) {
        recomendacoes.push('Há uma oportunidade elevada de economia fiscal, priorize ajustes no planejamento tributário.');
    } else {
        recomendacoes.push('A economia projetada é moderada; mantenha o acompanhamento mensal da carga tributária.');
    }
    if (creditos > 0) {
        recomendacoes.push(`Identificamos até ${fmtReais(creditos)} em créditos tributários: valide a recuperação desses saldos com seu contador.`);
    }
    if (anomalia > 0) {
        recomendacoes.push(`Detectamos uma possível anomalia de custo de ${fmtReais(anomalia)}; verifique despesas não usuais e fluxo de caixa.`);
    }

    const resumo = `Este diagnóstico sugere ${resultados.regimeIdeal} como melhor opção fiscal e indica até ${fmtReais(economia)} de economia anual, com ${fmtReais(creditos)} em créditos tributários identificados.`;
    return {
        resumo,
        recomendacoes
    };
}

async function gerarAnaliseFinanceira(diagnostico) {
    if (!process.env.GROQ_API_KEY) {
        return gerarAnaliseInterna(diagnostico);
    }

    try {
        const prompt = `Você é um analista financeiro para PMEs no Brasil. Com base nos dados abaixo, gere um resumo conciso e três recomendações práticas de melhoria financeira e tributária.`;
        const rawMensagem = `Dados do diagnóstico:\nNome: ${diagnostico.nome}\nCNPJ: ${diagnostico.cnpj}\nSetor: ${diagnostico.setor}\nRegime atual: ${diagnostico.regime}\nFaturamento anual: R$ ${diagnostico.faturamento && diagnostico.faturamento.toLocaleString ? diagnostico.faturamento.toLocaleString('pt-BR') : diagnostico.faturamento}\nMargem: ${diagnostico.margem}\nEconomia estimada: R$ ${diagnostico.resultados.economia}\nCréditos identificados: R$ ${diagnostico.resultados.creditosIdentificados}\nAnomalia identificada: R$ ${diagnostico.resultados.anomaliaValor}\nRegime ideal: ${diagnostico.resultados.regimeIdeal}`;
        const mensagem = sanitizeText(rawMensagem, 2000);

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: mensagem }
                ],
                max_tokens: 250,
                temperature: 0.6
            })
        });

        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content;
        if (!content) {
            return gerarAnaliseInterna(diagnostico);
        }

        return { resumo: String(content).trim(), recomendacoes: [] };
    } catch (error) {
        console.error('Groq analysis error:', error);
        return gerarAnaliseInterna(diagnostico);
    }
}

async function analisarComGroq(tipoDoc, textoDoc, contexto = '') {
    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_KEY) {
        return analisarLocalmente(tipoDoc, textoDoc);
    }
    const prompts = {
        dre: `Você é um analista financeiro especialista em PMEs brasileiras. Analise o DRE abaixo e retorne JSON com:
{"receita_bruta": number, "deducoes": number, "receita_liquida": number, "custos": number, "lucro_bruto": number, "despesas_operacionais": number, "ebitda": number, "lucro_liquido": number, "margem_bruta_pct": number, "margem_liquida_pct": number, "alertas": ["string"], "recomendacoes": ["string"], "resumo": "string"}`,
        balanco: `Você é um analista financeiro especialista em PMEs. Analise o Balanço Patrimonial e retorne JSON com:
{"ativo_total": number, "ativo_circulante": number, "ativo_nao_circulante": number, "passivo_total": number, "passivo_circulante": number, "patrimonio_liquido": number, "liquidez_corrente": number, "endividamento_pct": number, "alertas": ["string"], "recomendacoes": ["string"], "resumo": "string"}`,
        extrato: `Você é um especialista em conciliação bancária. Analise o extrato bancário e retorne JSON com:
{"saldo_inicial": number, "saldo_final": number, "total_entradas": number, "total_saidas": number, "num_transacoes": number, "categorias": [{"nome": "string", "valor": number}], "anomalias": ["string"], "itens_conciliacao": [{"data": "string", "descricao": "string", "valor": number, "tipo": "entrada|saida", "categoria": "string", "flag": "string"}], "recomendacoes": ["string"], "resumo": "string"}`
    };

    const systemPrompt = prompts[tipoDoc] || prompts.dre;
    const texto = sanitizeText(textoDoc, 12000);

    try {
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Documento:\n\n${texto}\n\nContexto adicional: ${sanitizeText(contexto, 1000)}\n\nRetorne SOMENTE o JSON, sem markdown, sem explicações.` }
                ],
                max_tokens: 2000,
                temperature: 0.2
            })
        });
        const payload = await resp.json();
        const content = payload?.choices?.[0]?.message?.content || '';
        const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        return { sucesso: true, dados: JSON.parse(jsonStr), fonte: 'groq-llama3' };
    } catch (e) {
        console.error('Groq error:', e.message);
        return analisarLocalmente(tipoDoc, textoDoc);
    }
}

function analisarLocalmente(tipoDoc, texto) {
    const numeros = (texto.match(/-?\(?\d{1,3}(?:\.\d{3})+(?:,\d{2})?\)?|-?\(?\d+,\d{2}\)?/g) || [])
        .map((raw) => {
            const negativo = raw.includes('(') || raw.trim().startsWith('-');
            const limpo = raw.replace(/[().-]/g, '').replace(',', '.');
            const valor = parseFloat(limpo);
            return negativo ? -valor : valor;
        })
        .filter(n => !isNaN(n) && Math.abs(n) > 100);
    const soma = numeros.reduce((a, b) => a + b, 0);
    const max = numeros.length ? Math.max(...numeros.map(Math.abs)) : 0;

    if (tipoDoc === 'extrato') {
        const entradas = numeros.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
        const saidas = numeros.filter((_, i) => i % 2 !== 0).reduce((a, b) => a + b, 0);
        return {
            sucesso: true,
            dados: {
                saldo_inicial: 0, saldo_final: entradas - saidas,
                total_entradas: entradas, total_saidas: saidas,
                num_transacoes: numeros.length,
                categorias: [{ nome: 'Outros', valor: soma }],
                anomalias: soma > 100000 ? ['Movimentação elevada detectada'] : [],
                recomendacoes: ['Envie documentos mais completos para obter uma análise mais detalhada.'],
                resumo: `Extrato processado com ${numeros.length} valores identificados. Saldo líquido estimado: R$ ${(entradas - saidas).toLocaleString('pt-BR')}.`
            },
            fonte: 'local'
        };
    }

    const normalizar = (valor) => String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const parseValoresLinha = (linha) => (linha.match(/-?\(?\d{1,3}(?:\.\d{3})+(?:,\d{2})?\)?|-?\(?\d+,\d{2}\)?/g) || [])
        .map((raw) => {
            const negativo = raw.includes('(') || raw.trim().startsWith('-');
            const limpo = raw.replace(/[().-]/g, '').replace(',', '.');
            const valor = parseFloat(limpo);
            return negativo ? -valor : valor;
        })
        .filter((valor) => Number.isFinite(valor));
    const valorPorRotulo = (rotulo) => {
        const alvo = normalizar(rotulo);
        const linhas = String(texto || '').split(/\r?\n/);
        let linha = '';
        for (let i = 0; i < linhas.length; i += 1) {
            const atual = normalizar(linhas[i]).trim();
            const janela = normalizar([linhas[i], linhas[i + 1] || ''].join(' ')).trim();
            if (atual === alvo || atual.startsWith(`${alvo} `) || janela === alvo || janela.startsWith(`${alvo} `)) {
                linha = linhas[i];
                if (!parseValoresLinha(linha).length) {
                    linha = [linhas[i], linhas[i + 1] || '', linhas[i + 2] || ''].join(' ');
                }
                break;
            }
        }
        const valores = parseValoresLinha(linha);
        if (!valores.length) return 0;
        return valores.length >= 3 ? valores[2] : valores[0];
    };

    const receitaOperacional = valorPorRotulo('Receitas Operacionais');
    const custoServicos = Math.abs(valorPorRotulo('Custos dos Serviços Prestados'));
    const resultadoBruto = valorPorRotulo('Resultado Bruto');
    const resultadoOperacional = valorPorRotulo('Resultado Antes das Receitas e Despesas Financeiras');
    const lucroLiquido = valorPorRotulo('Lucro Líquido do Exercício');
    const receitaBase = receitaOperacional || max;
    const lucroBruto = resultadoBruto || receitaBase * 0.47;
    const despesasOperacionais = resultadoOperacional
        ? Math.max(0, lucroBruto - resultadoOperacional)
        : receitaBase * 0.25;
    const lucroFinal = lucroLiquido || receitaBase * 0.12;

    return {
        sucesso: true,
        dados: {
            receita_bruta: receitaBase,
            deducoes: 0,
            receita_liquida: receitaBase,
            custos: custoServicos || receitaBase * 0.45,
            lucro_bruto: lucroBruto,
            despesas_operacionais: despesasOperacionais,
            ebitda: resultadoOperacional || receitaBase * 0.22,
            lucro_liquido: lucroFinal,
            margem_bruta_pct: receitaBase ? Math.round((lucroBruto / receitaBase) * 100) : 0,
            margem_liquida_pct: receitaBase ? Math.round((lucroFinal / receitaBase) * 100) : 0,
            alertas: ['Análise local aproximada com base nos valores identificados.'],
            recomendacoes: ['Envie demonstrativos completos para melhorar a precisão da análise.'],
            resumo: `Documento processado localmente. ${numeros.length} valores financeiros identificados.`
        },
        fonte: 'local'
    };
}

module.exports = {
    gerarAnaliseFinanceira,
    analisarComGroq
};
