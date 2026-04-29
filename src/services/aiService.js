function fmtReais(valor) {
    return 'R$ ' + Math.round(Number(valor) || 0).toLocaleString('pt-BR');
}

function sanitizeText(input, maxLen = 100000) {
    if (!input) return '';
    let s = String(input);
    s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
    s = s.replace(/[ \t]+/g, ' ');
    s = s.replace(/\bP[áa]gina?\s*\d+\b/gi, '');
    s = s.replace(/\bPage\s*\d+\b/gi, '');
    return s.slice(0, maxLen).trim();
}

function normalizeLabel(label) {
    return String(label || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase();
}

function safeJsonParse(text) {
    if (!text) return null;
    let clean = text.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        clean = clean.slice(firstBrace, lastBrace + 1);
    }
    try {
        return JSON.parse(clean);
    } catch {
        const fixed = clean.replace(/,(\s*[}\]])/g, '$1');
        try {
            return JSON.parse(fixed);
        } catch {
            return null;
        }
    }
}

function buildConfidence(dados, tipoDoc) {
    if (!dados || typeof dados !== 'object') {
        return { score: 0, flags: ['Nenhum dado estruturado retornado'] };
    }
    const flags = [];
    let score = 0.5;
    if (tipoDoc === 'dre') {
        const rb = Number(dados.receita_bruta ?? dados.receitaBruta ?? dados.receita ?? 0);
        const ll = Number(dados.lucro_liquido ?? dados.lucroLiquido ?? dados.lucro ?? 0);
        if (rb > 0) score += 0.25; else flags.push('Receita bruta não identificada');
        if (ll !== 0) score += 0.15; else flags.push('Lucro líquido não identificado');
        if ((dados.margem_bruta_pct ?? dados.margemBrutaPct ?? -1) >= 0) score += 0.1;
        else flags.push('Margem bruta não calculada');
    } else if (tipoDoc === 'balanco') {
        const at = Number(dados.ativo_total ?? dados.ativoTotal ?? 0);
        const pl = Number(dados.patrimonio_liquido ?? dados.patrimonioLiquido ?? 0);
        if (at > 0) score += 0.3; else flags.push('Ativo total não identificado');
        if (pl !== 0) score += 0.2; else flags.push('Patrimônio líquido não identificado');
    } else if (tipoDoc === 'extrato') {
        const te = Number(dados.total_entradas ?? dados.totalEntradas ?? 0);
        const ts = Number(dados.total_saidas ?? dados.totalSaidas ?? 0);
        if (te > 0 || ts > 0) score += 0.4; else flags.push('Nenhuma movimentação identificada');
        if ((dados.categorias ?? []).length > 1) score += 0.2;
    }
    return { score: Math.min(1, Math.max(0, score)), flags };
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

    const resumo = creditos > 0
        ? `Este diagnóstico sugere ${resultados.regimeIdeal} como melhor opção fiscal e indica até ${fmtReais(economia)} de economia anual, com ${fmtReais(creditos)} em créditos tributários identificados.`
        : `Este diagnóstico sugere ${resultados.regimeIdeal} como melhor opção fiscal e indica até ${fmtReais(economia)} de economia anual. Créditos tributários exigem documentos fiscais para estimativa confiável.`;
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

async function callGroq(messages, maxTokens = 2000, retries = 1) {
    const GROQ_KEY = process.env.GROQ_API_KEY;
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_KEY}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages,
                    max_tokens: maxTokens,
                    temperature: 0.1
                })
            });
            let payload;
            const rawText = await resp.text();
            try {
                payload = JSON.parse(rawText);
            } catch {
                payload = null;
            }
            if (!resp.ok) {
                const msg = payload?.error?.message || rawText.slice(0, 300);
                throw new Error(`Groq HTTP ${resp.status}: ${msg}`);
            }
            if (payload?.error) {
                throw new Error(payload.error.message || JSON.stringify(payload.error));
            }
            const content = payload?.choices?.[0]?.message?.content || '';
            const dados = safeJsonParse(content);
            if (dados) {
                return { dados, raw: content, attempt };
            }
            if (attempt < retries) {
                messages.push({
                    role: 'user',
                    content: 'A resposta anterior não foi um JSON válido. Retorne APENAS um objeto JSON, sem texto fora do JSON, sem markdown, sem explicações.'
                });
            }
            lastError = new Error(`JSON parse falhou na tentativa ${attempt + 1}. Resposta: ${content.slice(0, 300)}`);
        } catch (err) {
            lastError = err;
            console.error(`Groq attempt ${attempt + 1} failed:`, err.message);
        }
    }
    throw lastError || new Error('Falha ao obter JSON válido da Groq após retries');
}

async function analisarComGroq(tipoDoc, textoDoc, contexto = '') {
    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_KEY) {
        return analisarLocalmente(tipoDoc, textoDoc);
    }
    const prompts = {
        dre: `Você é analista financeiro especialista em PMEs brasileiras. Analise o DRE abaixo e extraia os valores numéricos principais. Formato numérico: 1.234.567,89 (ponto milhar, vírgula decimal). Ignore cabeçalhos, rodapés e números de página.

Retorne EXCLUSIVAMENTE JSON:
{"receita_bruta": number, "deducoes": number, "receita_liquida": number, "custos": number, "lucro_bruto": number, "despesas_operacionais": number, "ebitda": number, "lucro_liquido": number, "margem_bruta_pct": number, "margem_liquida_pct": number, "alertas": ["string"], "recomendacoes": ["string"], "resumo": "string"}

Exemplo: {"receita_bruta":1250000.00,"deducoes":25000.00,"receita_liquida":1225000.00,"custos":612500.00,"lucro_bruto":612500.00,"despesas_operacionais":245000.00,"ebitda":367500.00,"lucro_liquido":245000.00,"margem_bruta_pct":0.50,"margem_liquida_pct":0.20,"alertas":["Despesas subiram 12%"],"recomendacoes":["Rever aluguel"],"resumo":"Margem bruta 50%, mas despesas elevadas."}`,
        balanco: `Você é analista financeiro especialista em PMEs brasileiras. Analise o Balanço Patrimonial e extraia os valores numéricos. Formato: 1.234.567,89 (ponto milhar, vírgula decimal). Ignore cabeçalhos, rodapés.

Retorne EXCLUSIVAMENTE JSON:
{"ativo_total": number, "ativo_circulante": number, "ativo_não_circulante": number, "passivo_total": number, "passivo_circulante": number, "patrimonio_liquido": number, "liquidez_corrente": number, "endividamento_pct": number, "alertas": ["string"], "recomendacoes": ["string"], "resumo": "string"}

Exemplo: {"ativo_total":2500000.00,"ativo_circulante":1250000.00,"ativo_não_circulante":1250000.00,"passivo_total":1500000.00,"passivo_circulante":875000.00,"patrimonio_liquido":1000000.00,"liquidez_corrente":1.43,"endividamento_pct":0.60,"alertas":["Endividamento alto"],"recomendacoes":["Reduzir passivo circulante"],"resumo":"Liquidez 1,43 OK, mas endividamento 60% preocupante."}`,
        extrato: `Você é especialista em conciliação bancária. Analise o extrato e extraia totais e padrões. Formato: 1.234.567,89 (ponto milhar, vírgula decimal). Ignore cabeçalhos.

Retorne EXCLUSIVAMENTE JSON:
{"saldo_inicial": number, "saldo_final": number, "total_entradas": number, "total_saidas": number, "num_transacoes": number, "categorias": [{"nome": "string", "valor": number}], "anomalias": ["string"], "itens_conciliacao": [{"data": "string", "descricao": "string", "valor": number, "tipo": "entrada|saida", "categoria": "string", "flag": "string"}], "recomendacoes": ["string"], "resumo": "string"}

Exemplo: {"saldo_inicial":45230.00,"saldo_final":38910.00,"total_entradas":125000.00,"total_saidas":131320.00,"num_transacoes":42,"categorias":[{"nome":"Receita","valor":95000.00},{"nome":"Fornecedor","valor":45000.00}],"anomalias":["Saida de R$ 15.000 sem descricao"],"itens_conciliacao":[{"data":"2024-01-15","descricao":"PIX Cliente A","valor":5000.00,"tipo":"entrada","categoria":"Receita","flag":"OK"}],"recomendacoes":["Classificar 12 transacoes"],"resumo":"Saldo reduziu R$ 6.320. Receitas cobriram 96% das saidas."}`
    };

    const systemPrompt = prompts[tipoDoc] || prompts.dre;
    const texto = sanitizeText(textoDoc, 100000);

    try {
        const { dados } = await callGroq([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Documento:\n\n${texto}\n\nContexto adicional: ${sanitizeText(contexto, 1000)}\n\nRetorne SOMENTE o JSON válido, sem markdown, sem texto fora do JSON.` }
        ], 2000, 1);
        const confianca = buildConfidence(dados, tipoDoc);
        return { sucesso: true, dados, fonte: 'groq-llama3', confianca };
    } catch (e) {
        console.error('Groq error:', e.message);
        return analisarLocalmente(tipoDoc, textoDoc);
    }
}

function parseValoresLinha(linha) {
    return (String(linha).match(/-?\(?\d{1,3}(?:\.\d{3})+(?:,\d{2})?\)?|-?\(?\d+,\d{2}\)?/g) || [])
        .map((raw) => {
            const negativo = raw.includes('(') || raw.trim().startsWith('-');
            const limpo = raw.replace(/[().\s-]/g, '').replace(',', '.');
            const valor = parseFloat(limpo);
            return negativo ? -valor : valor;
        })
        .filter((valor) => Number.isFinite(valor));
}

function buscarValorPorRotulos(texto, rotulosPossiveis) {
    const linhas = String(texto || '').split(/\r?\n/);
    for (let i = 0; i < linhas.length; i += 1) {
        const atualNorm = normalizeLabel(linhas[i]);
        for (const rotulo of rotulosPossiveis) {
            const rNorm = normalizeLabel(rotulo);
            if (atualNorm.includes(rNorm)) {
                // Primeiro tenta valores na mesma linha
                let valores = parseValoresLinha(linhas[i]);
                // Se nenhum valor, olha proximas 2 linhas (quebra de linha em PDFs)
                if (!valores.length) {
                    const janela = [linhas[i], linhas[i + 1] || '', linhas[i + 2] || ''].join(' ');
                    valores = parseValoresLinha(janela);
                }
                if (valores.length) {
                    // Em balancos/DREs com multiplas colunas, geralmente o ultimo valor é o mais atual
                    return valores.length >= 2 ? valores[valores.length - 1] : valores[0];
                }
            }
        }
    }
    return 0;
}

function analisarLocalmente(tipoDoc, texto) {
    const numeros = (texto.match(/-?\(?\d{1,3}(?:\.\d{3})+(?:,\d{2})?\)?|-?\(?\d+,\d{2}\)?/g) || [])
        .map((raw) => {
            const negativo = raw.includes('(') || raw.trim().startsWith('-');
            const limpo = raw.replace(/[().\s-]/g, '').replace(',', '.');
            const valor = parseFloat(limpo);
            return negativo ? -valor : valor;
        })
        .filter(n => !isNaN(n) && Math.abs(n) > 100);
    const soma = numeros.reduce((a, b) => a + b, 0);
    const max = numeros.length ? Math.max(...numeros.map(Math.abs)) : 0;

    if (tipoDoc === 'extrato') {
        const linhas = String(texto || '').split(/\r?\n/);
        let entradas = 0;
        let saidas = 0;
        let numTransacoes = 0;
        let saldoInicial = 0;
        let saldoFinal = 0;
        const itensConciliacao = [];
        for (const linha of linhas) {
            const linhaLower = linha.toLowerCase();
            const dataMatch = linha.match(/\b(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\b/);
            const valores = parseValoresLinha(linha);
            if (!valores.length) continue;
            const valor = valores[valores.length - 1];

            // Detectar saldo inicial/final; não contar como transação
            if (linhaLower.includes('saldo anterior') || linhaLower.includes('saldo inicial')) {
                saldoInicial = Math.abs(valor);
                continue;
            }
            if (linhaLower.includes('saldo final') || linhaLower.includes('saldo disponivel')) {
                saldoFinal = Math.abs(valor);
                continue;
            }

            // Ignorar totais e subtotais
            if (linhaLower.includes('total') || linhaLower.includes('subtotal')) continue;

            if (dataMatch) {
                numTransacoes += 1;
                if (valor > 0) entradas += valor;
                else if (valor < 0) saidas += Math.abs(valor);
                itensConciliacao.push({
                    data: dataMatch[1],
                    descricao: linha.slice(0, 80).trim(),
                    valor: Math.abs(valor),
                    tipo: valor >= 0 ? 'entrada' : 'saida',
                    categoria: 'Não classificado',
                    flag: 'LOCAL'
                });
            }
        }
        // Se não achou saldo_inicial/final explícito, inferir pelo maior número positivo/negativo
        if (!saldoInicial && numeros.length) {
            saldoInicial = numeros[0] || 0;
        }
        if (!saldoFinal && numeros.length) {
            saldoFinal = numeros[numeros.length - 1] || 0;
        }
        const saldoCalculado = entradas - saidas;
        return {
            sucesso: true,
            dados: {
                saldo_inicial: saldoInicial,
                saldo_final: saldoFinal || saldoCalculado,
                total_entradas: entradas,
                total_saidas: saidas,
                num_transacoes: numTransacoes,
                categorias: [{ nome: 'Outros', valor: soma }],
                anomalias: soma > 100000 ? ['Movimentação elevada detectada'] : [],
                itens_conciliacao: itensConciliacao.slice(0, 20),
                recomendacoes: ['Envie documentos mais completos ou verifique se o extrato esta em formato de texto.'],
                resumo: `Extrato processado localmente com ${numTransacoes} transações identificadas. Saldo líquido estimado: R$ ${saldoCalculado.toLocaleString('pt-BR')}.`
            },
            fonte: 'local',
            confianca: { score: numTransacoes > 0 ? 0.35 : 0.1, flags: ['Análise local aproximada'] }
        };
    }

    if (tipoDoc === 'balanco') {
        const ativoTotal = buscarValorPorRotulos(texto, ['Ativo Total', 'TOTAL DO ATIVO']);
        const ativoCirculante = buscarValorPorRotulos(texto, ['Ativo Circulante', 'Circulante']);
        const ativoNãoCirculante = buscarValorPorRotulos(texto, ['Ativo Não Circulante', 'Ativo Realizável a Longo Prazo', 'Imobilizado', 'Intangível']);
        const passivoTotal = buscarValorPorRotulos(texto, ['Passivo Total', 'TOTAL DO PASSIVO']);
        const passivoCirculante = buscarValorPorRotulos(texto, ['Passivo Circulante', 'Exigivel a Curto Prazo']);
        const patrimonioLiquido = buscarValorPorRotulos(texto, ['Patrimônio Líquido', 'Patrimônio Líquido Consolidado', 'PL']);
        const ativoBase = ativoTotal || max;
        const plBase = patrimonioLiquido || (ativoBase * 0.4);
        const pcBase = passivoCirculante || (ativoBase * 0.35);
        const liquidez = ativoCirculante > 0 && pcBase > 0 ? +(ativoCirculante / pcBase).toFixed(2) : 0;
        const endividamento = ativoBase > 0 ? +((passivoTotal || (ativoBase - plBase)) / ativoBase).toFixed(2) : 0;
        return {
            sucesso: true,
            dados: {
                ativo_total: ativoBase,
                ativo_circulante: ativoCirculante || ativoBase * 0.55,
                ativo_não_circulante: ativoNãoCirculante || ativoBase * 0.45,
                passivo_total: passivoTotal || ativoBase - plBase,
                passivo_circulante: pcBase,
                patrimonio_liquido: plBase,
                liquidez_corrente: liquidez,
                endividamento_pct: endividamento,
                alertas: ['Análise local aproximada com base nos valores identificados.'],
                recomendacoes: ['Envie demonstrativos completos para melhorar a precisão da análise.'],
                resumo: `Balanço processado localmente. Ativo total R$ ${ativoBase.toLocaleString('pt-BR')}, liquidez ${liquidez.toFixed(2)}.`
            },
            fonte: 'local',
            confianca: { score: ativoTotal > 0 ? 0.4 : 0.15, flags: ['Análise local aproximada'] }
        };
    }

    // DRE (padrão)
    const receitaBruta = buscarValorPorRotulos(texto, ['Receita Bruta', 'Receitas Operacionais', 'Vendas', 'Faturamento']);
    const deducoesRaw = buscarValorPorRotulos(texto, ['Deduções', 'Impostos sobre Vendas', 'Tributos']);
    const custosRaw = buscarValorPorRotulos(texto, ['Custo dos Serviços', 'Custo dos Produtos', 'CMV', 'CPV', 'Custos']);
    const lucroBruto = buscarValorPorRotulos(texto, ['Lucro Bruto', 'Resultado Bruto']);
    const despesasOpRaw = buscarValorPorRotulos(texto, ['Despesas Operacionais', 'Despesas Administrativas', 'Despesas Comerciais', 'Despesas Gerais']);
    const lucroLiquido = buscarValorPorRotulos(texto, ['Lucro Líquido', 'Lucro Líquido do Exercício', 'Resultado Líquido']);
    const receitaBase = receitaBruta || max;
    // Valores dedutores no DRE costumam vir entre parenteses (negativos no parse); normalizar para positivo
    const deducoes = Math.abs(deducoesRaw);
    const custos = Math.abs(custosRaw);
    const despesasOp = Math.abs(despesasOpRaw);
    const rl = receitaBase - deducoes;
    const lb = lucroBruto || (rl - custos);
    const ll = lucroLiquido || (lb - despesasOp);
    return {
        sucesso: true,
        dados: {
            receita_bruta: receitaBase,
            deducoes: deducoes || 0,
            receita_liquida: rl,
            custos: custos || receitaBase * 0.45,
            lucro_bruto: lb,
            despesas_operacionais: despesasOp || receitaBase * 0.25,
            ebitda: lb - (despesasOp || receitaBase * 0.25),
            lucro_liquido: ll,
            margem_bruta_pct: receitaBase ? +((lb / receitaBase) * 100).toFixed(1) : 0,
            margem_liquida_pct: receitaBase ? +((ll / receitaBase) * 100).toFixed(1) : 0,
            alertas: ['Análise local aproximada com base nos valores identificados.'],
            recomendacoes: ['Envie demonstrativos completos para melhorar a precisão da análise.'],
            resumo: `DRE processado localmente. Receita R$ ${receitaBase.toLocaleString('pt-BR')}, lucro líquido R$ ${ll.toLocaleString('pt-BR')}.`
        },
        fonte: 'local',
        confianca: { score: receitaBruta > 0 ? 0.4 : 0.15, flags: ['Análise local aproximada'] }
    };
}

module.exports = {
    gerarAnaliseFinanceira,
    analisarComGroq
};
