<<<<<<< D:/Projetos Devs/finpj/src/controllers/documentController.js
const { salvarAnalise, obterAnalises, obterUsuario } = require('../services/database');
const { analisarComGroq } = require('../services/aiService');

const MAX_EXTRACTED_CHARS = Number(process.env.MAX_EXTRACTED_CHARS || 16000);
const MAX_ANALYSES_RETURNED = Number(process.env.MAX_ANALYSES_RETURNED || 20);

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'];

async function extrairTextoOCR(buffer) {
    const { createWorker } = require('tesseract.js');
    const worker = await createWorker('por');
    try {
        const ret = await worker.recognize(buffer);
        return ret.data.text || '';
    } finally {
        await worker.terminate();
    }
}

function isImageFile(mime, nome) {
    if (IMAGE_MIME_TYPES.includes(mime)) return true;
    if (IMAGE_EXTENSIONS.some(ext => nome.endsWith(ext))) return true;
    return false;
}

function compactarArray(valor, limite = 8) {
    if (!Array.isArray(valor)) return valor;
    return valor.slice(0, limite).map((item) => {
        if (typeof item === 'string') return item.slice(0, 500);
        if (!item || typeof item !== 'object') return item;
        return Object.fromEntries(
            Object.entries(item)
                .slice(0, 12)
                .map(([key, val]) => [key, typeof val === 'string' ? val.slice(0, 300) : val])
        );
    });
}

function compactarResultadoAnalise(dados) {
    if (!dados || typeof dados !== 'object') return dados;

    const chaves = [
        'resumo',
        'alertas',
        'recomendacoes',
        'anomalias',
        'categorias',
        'itens_conciliacao',
        'receita_bruta',
        'receita_liquida',
        'deducoes',
        'custos',
        'lucro_bruto',
        'despesas_operacionais',
        'ebitda',
        'total_entradas',
        'total_saidas',
        'saldo_final',
        'lucro_liquido',
        'margem_bruta_pct',
        'margem_liquida_pct',
        'liquidez_corrente',
        'endividamento_pct'
    ];

    const compacto = {};
    chaves.forEach((key) => {
        if (dados[key] === undefined) return;
        if (typeof dados[key] === 'string') compacto[key] = dados[key].slice(0, 1200);
        else if (Array.isArray(dados[key])) compacto[key] = compactarArray(dados[key], key === 'itens_conciliacao' ? 20 : 8);
        else compacto[key] = dados[key];
    });

    return Object.keys(compacto).length ? compacto : dados;
}

async function extrairTextoPDF(buffer) {
    try {
        const pdfParse = require('pdf-parse');

        if (typeof pdfParse === 'function') {
            const data = await pdfParse(buffer);
            return data.text || '';
        }

        if (pdfParse.PDFParse) {
            const parser = new pdfParse.PDFParse({ data: buffer });
            try {
                const data = await parser.getText();
                return data.text || '';
            } finally {
                if (typeof parser.destroy === 'function') {
                    await parser.destroy();
                }
            }
        }

        if (typeof pdfParse.default === 'function') {
            const data = await pdfParse.default(buffer);
            return data.text || '';
        }

        throw new Error('Versão do pdf-parse sem extrator compatível.');
    } catch (e) {
        console.error('PDF parse error:', e.message);
        return '';
    }
}

function normalizarBusca(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function encontrarTrechoContabil(texto, tipo, limite) {
    if (!texto || texto.length <= limite) return texto;

    const normalizado = normalizarBusca(texto);
    const termosPorTipo = {
        dre: [
            'demonstracao do resultado',
            'demonstracao dos resultados',
            'receitas operacionais',
            'receita liquida',
            'lucro liquido do exercicio',
            'lucro liquido',
            'resultado do exercicio',
            'ebitda',
            'despesas operacionais'
        ],
        balanco: [
            'balanco patrimonial',
            'ativo total',
            'ativo circulante',
            'passivo total',
            'passivo circulante',
            'patrimonio liquido'
        ],
        extrato: [
            'saldo anterior',
            'saldo inicial',
            'saldo final',
            'saldo disponivel',
            'historico',
            'transacoes',
            'lancamentos'
        ]
    };

    const termos = termosPorTipo[tipo] || termosPorTipo.dre;
    const candidatos = [];
    termos.forEach((termo) => {
        let pos = -1;
        while ((pos = normalizado.indexOf(termo, pos + 1)) !== -1) {
            candidatos.push(pos);
        }
    });

    if (!candidatos.length) {
        return texto.slice(0, limite);
    }

    // Escolher a primeira ocorrencia como inicio do trecho relevante
    const inicioRaw = candidatos.sort((a, b) => a - b)[0];
    const margemAnterior = 800;
    const startRaw = Math.max(0, inicioRaw - margemAnterior);

    // Expandir até o proximo termo relevante (ultima ocorrencia dentro do limite)
    const fimRaw = candidatos.filter(p => p > startRaw && p < startRaw + limite).pop() || (startRaw + limite);
    const endRaw = Math.min(texto.length, Math.max(startRaw + limite, fimRaw + 400));

    // Alinhar a cortes com quebras de linha para nao cortar no meio de uma linha/tabela
    let start = startRaw;
    while (start > 0 && texto[start - 1] !== '\n') start -= 1;

    let end = endRaw;
    while (end < texto.length && texto[end] !== '\n') end += 1;
    end = Math.min(texto.length, end);

    // Se o trecho ainda excede o limite, faz o corte mais conservador
    if (end - start > limite) {
        end = start + limite;
        while (end > start && texto[end - 1] !== '\n') end -= 1;
    }

    return texto.slice(start, end);
}

function possuiTermosContabeisMinimos(texto, tipo) {
    const n = normalizarBusca(texto);
    const mapa = {
        dre: ['receita', 'lucro', 'custo', 'despesa', 'resultado'],
        balanco: ['ativo', 'passivo', 'patrimonio', 'circulante'],
        extrato: ['saldo', 'data', 'historico', 'transacao', 'lancamento']
    };
    const termos = mapa[tipo] || mapa.dre;
    return termos.some(t => n.includes(t));
}

function extrairTextoExcel(buffer) {
    try {
        const XLSX = require('xlsx');
        const wb = XLSX.read(buffer, { type: 'buffer' });
        let texto = '';
        wb.SheetNames.forEach(name => {
            const ws = wb.Sheets[name];
            const csv = XLSX.utils.sheet_to_csv(ws);
            texto += `=== Aba: ${name} ===\n${csv}\n\n`;
        });
        return texto;
    } catch (e) {
        console.error('Excel parse error:', e.message);
        return '';
    }
}

async function uploadDocumento(req, res) {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
    const { tipo = 'dre', contexto = '' } = req.body;

    let texto = '';
    const mime = req.file.mimetype;
    const nome = req.file.originalname.toLowerCase();

    if (isImageFile(mime, nome)) {
        console.log(`[uploadDocumento] OCR em imagem: ${req.file.originalname}`);
        texto = await extrairTextoOCR(req.file.buffer);
    } else if (mime === 'application/pdf' || nome.endsWith('.pdf')) {
        texto = await extrairTextoPDF(req.file.buffer);
    } else if (nome.match(/\.(xlsx|xls|ods)$/)) {
        texto = extrairTextoExcel(req.file.buffer);
    } else {
        texto = req.file.buffer.toString('utf-8');
    }

    console.log(`[uploadDocumento] tipo=${tipo} arquivo=${req.file.originalname} tamanhoTextoExtraido=${texto.length}`);

    const textoLimpo = texto.trim();
    if (!textoLimpo) {
        return res.status(422).json({
            erro: 'Não foi possível extrair texto do documento.',
            sugestao: 'Se for um PDF digitalizado (imagem), converta-o para PNG/JPG e envie, ou use um arquivo Excel/CSV.',
            acoes: ['converter_pdf_para_imagem', 'enviar_excel']
        });
    }

    // Heuristica: menos de 100 caracteres ou quase so numeros = provavel PDF digitalizado mal extraido
    if (textoLimpo.length < 100 || textoLimpo.replace(/[\d\s.,\-/]/g, '').length < 30) {
        return res.status(422).json({
            erro: 'Texto extraido muito curto ou sem conteudo semantico.',
            sugestao: 'Verifique se o PDF esta selecionavel ou converta-o para imagem/Excel.',
            acoes: ['converter_pdf_para_imagem', 'enviar_excel']
        });
    }

    if (!possuiTermosContabeisMinimos(textoLimpo, tipo)) {
        console.warn(`[uploadDocumento] Documento ${req.file.originalname} não contém termos contábeis mínimos esperados para tipo=${tipo}`);
    }

    texto = encontrarTrechoContabil(textoLimpo, tipo, MAX_EXTRACTED_CHARS);
    console.log(`[uploadDocumento] trechoEnviadoIA=${texto.length} caracteres`);

    const analise = await analisarComGroq(tipo, texto, contexto);
    const resultadoCompacto = compactarResultadoAnalise(analise.dados);
    await salvarAnalise({
        email: req.userEmail,
        tipo,
        nomeArquivo: req.file.originalname,
        tamanho: req.file.size,
        data: new Date().toISOString(),
        resultado: resultadoCompacto,
        fonte: analise.fonte,
        confianca: analise.confianca
    });

    res.json({ sucesso: true, ...analise, dados: resultadoCompacto, nomeArquivo: req.file.originalname });
}

async function getAnalises(req, res) {
    try {
        const analises = await obterAnalises(req.userEmail);
        const compactas = analises.slice(0, MAX_ANALYSES_RETURNED).map((analise) => ({
            id: analise.id,
            tipo: analise.tipo,
            nomeArquivo: analise.nomeArquivo,
            tamanho: analise.tamanho,
            data: analise.data,
            fonte: analise.fonte,
            confianca: analise.confianca,
            resultado: compactarResultadoAnalise(analise.resultado)
        }));
        res.json({ sucesso: true, analises: compactas });
    } catch (e) {
        console.error('Erro ao obter análises:', e);
        res.status(500).json({ erro: 'Não foi possível carregar as análises.' });
    }
}

async function postChat(req, res) {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ erro: 'Mensagem obrigatória.' });
    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_KEY) return res.json({ sucesso: true, resposta: 'A análise por IA está temporariamente indisponível.', fonte: 'local' });
    try {
        const usuario = await obterUsuario(req.userEmail);
        const banks = usuario?.connectedBanks || [];
        const txSummary = banks.flatMap(b => (b.transactions || []).slice(0, 5).map(t => `${t.data}: ${t.descricao} R$${t.valor}`)).join('\n');
        const sysPrompt = `Você é o assistente financeiro FinPJ para PMEs brasileiras. Responda de forma concisa e prática em português. Dados do usuário:\n- E-mail: ${req.userEmail}\n- Bancos conectados: ${banks.length}\n- Últimas transações:\n${txSummary || 'Nenhuma'}\n${context || ''}`;
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: message }], max_tokens: 1000, temperature: 0.4 })
        });
        const payload = await resp.json();
        const content = payload?.choices?.[0]?.message?.content || 'Não consegui processar sua pergunta.';
        res.json({ sucesso: true, resposta: content, fonte: 'groq-llama3' });
    } catch (e) {
        console.error('Chat error:', e);
        res.json({ sucesso: true, resposta: 'Erro ao processar. Tente novamente.', fonte: 'error' });
    }
}

async function getUploadUrl(req, res) {
    const { filename, contentType, size } = req.body;
    if (!filename || !contentType) {
        return res.status(400).json({ erro: 'Nome do arquivo e tipo de conteúdo são obrigatórios.' });
    }
    const MAX_SIZE = 50 * 1024 * 1024;
    if (size && size > MAX_SIZE) {
        return res.status(413).json({ erro: 'Arquivo muito grande. Limite de 50 MB.' });
    }
    const { isStorageConfigured, generateUploadUrl, sanitizeFilename, R2_BUCKET_NAME } = require('../services/storageService');
    if (!isStorageConfigured()) {
        return res.status(503).json({ erro: 'Serviço de storage não configurado.', fallback: true });
    }
    const safeName = sanitizeFilename(filename);
    const key = `uploads/${Date.now()}-${req.userEmail.replace(/[^a-zA-Z0-9]/g, '_')}-${safeName}`;
    try {
        const uploadUrl = await generateUploadUrl(key, contentType, 300);
        res.json({
            sucesso: true,
            uploadUrl,
            key,
            bucket: R2_BUCKET_NAME,
            publicUrl: null,
            expiresIn: 300
        });
    } catch (e) {
        console.error('[getUploadUrl] Erro:', e.message);
        res.status(500).json({ erro: 'Erro ao gerar URL de upload.', fallback: true });
    }
}

async function processDocumentFromUrl(req, res) {
    const { key, tipo = 'dre', contexto = '', filename, size } = req.body;
    if (!key) {
        return res.status(400).json({ erro: 'Chave do arquivo é obrigatória.' });
    }
    const { isStorageConfigured, generateDownloadUrl, deleteObject } = require('../services/storageService');
    if (!isStorageConfigured()) {
        return res.status(503).json({ erro: 'Serviço de storage não configurado.' });
    }
    let texto = '';
    let downloadUrl;
    try {
        downloadUrl = await generateDownloadUrl(key, 300);
    } catch (e) {
        console.error('[processDocumentFromUrl] Erro ao gerar download URL:', e.message);
        return res.status(500).json({ erro: 'Erro ao acessar arquivo.' });
    }
    try {
        // Usar fetch nativo do Node.js 18+ (não precisa de node-fetch)
        const fileRes = await fetch(downloadUrl);
        if (!fileRes.ok) {
            throw new Error(`HTTP ${fileRes.status}`);
        }
        const buffer = Buffer.from(await fileRes.arrayBuffer());
        const nome = (filename || key).toLowerCase();
        const mime = fileRes.headers.get('content-type') || 'application/octet-stream';
        if (isImageFile(mime, nome)) {
            console.log(`[processDocumentFromUrl] OCR em imagem: ${filename || key}`);
            texto = await extrairTextoOCR(buffer);
        } else if (mime === 'application/pdf' || nome.endsWith('.pdf')) {
            texto = await extrairTextoPDF(buffer);
        } else if (nome.match(/\.(xlsx|xls|ods)$/)) {
            texto = extrairTextoExcel(buffer);
        } else {
            texto = buffer.toString('utf-8');
        }
        console.log(`[processDocumentFromUrl] tipo=${tipo} arquivo=${filename || key} tamanhoTextoExtraido=${texto.length}`);
        const textoLimpo = texto.trim();
        if (!textoLimpo) {
            await deleteObject(key).catch(() => {});
            return res.status(422).json({
                erro: 'Não foi possível extrair texto do documento.',
                sugestao: 'Se for um PDF digitalizado (imagem), converta-o para PNG/JPG e envie, ou use um arquivo Excel/CSV.',
                acoes: ['converter_pdf_para_imagem', 'enviar_excel']
            });
        }
        if (textoLimpo.length < 100 || textoLimpo.replace(/[\d\s.,\-/]/g, '').length < 30) {
            await deleteObject(key).catch(() => {});
            return res.status(422).json({
                erro: 'Texto extraído muito curto ou sem conteúdo semântico.',
                sugestao: 'Verifique se o PDF está selecionável ou converta-o para imagem/Excel.',
                acoes: ['converter_pdf_para_imagem', 'enviar_excel']
            });
        }
        if (!possuiTermosContabeisMinimos(textoLimpo, tipo)) {
            console.warn(`[processDocumentFromUrl] Documento ${filename || key} não contém termos contábeis mínimos esperados para tipo=${tipo}`);
        }
        texto = encontrarTrechoContabil(textoLimpo, tipo, MAX_EXTRACTED_CHARS);
        console.log(`[processDocumentFromUrl] trechoEnviadoIA=${texto.length} caracteres`);
        const analise = await analisarComGroq(tipo, texto, contexto);
        const resultadoCompacto = compactarResultadoAnalise(analise.dados);
        await salvarAnalise({
            email: req.userEmail,
            tipo,
            nomeArquivo: filename || key,
            tamanho: size || buffer.length,
            data: new Date().toISOString(),
            resultado: resultadoCompacto,
            fonte: analise.fonte,
            confianca: analise.confianca
        });
        await deleteObject(key).catch((e) => {
            console.warn('[processDocumentFromUrl] Falha ao deletar arquivo temporário:', e.message);
        });
        res.json({ sucesso: true, ...analise, dados: resultadoCompacto, nomeArquivo: filename || key });
    } catch (e) {
        console.error('[processDocumentFromUrl] Erro:', e.message);
        await deleteObject(key).catch(() => {});
        res.status(500).json({ erro: 'Erro ao processar documento.', detalhes: e.message });
    }
}

module.exports = {
    uploadDocumento,
    getAnalises,
    postChat,
    getUploadUrl,
    processDocumentFromUrl
};
=======
const { salvarAnalise, obterAnalises, obterUsuario } = require('../services/database');
const { analisarComGroq } = require('../services/aiService');

const MAX_EXTRACTED_CHARS = Number(process.env.MAX_EXTRACTED_CHARS || 16000);
const MAX_ANALYSES_RETURNED = Number(process.env.MAX_ANALYSES_RETURNED || 20);

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'];

// Carrega extratores no topo para falhas serem detectadas no startup, não silenciosamente em runtime
let pdfParseModule = null;
try {
    pdfParseModule = require('pdf-parse');
} catch (e) {
    console.error('[documentController] Falha ao carregar pdf-parse:', e.message);
}

let tesseractModule = null;
try {
    tesseractModule = require('tesseract.js');
} catch (e) {
    console.error('[documentController] Falha ao carregar tesseract.js:', e.message);
}

async function extrairTextoOCR(buffer) {
    if (!tesseractModule) {
        console.error('[extrairTextoOCR] tesseract.js não disponível.');
        return '';
    }
    const worker = await tesseractModule.createWorker('por');
    try {
        const ret = await worker.recognize(buffer);
        return ret.data.text || '';
    } finally {
        await worker.terminate();
    }
}

function isImageFile(mime, nome) {
    if (IMAGE_MIME_TYPES.includes(mime)) return true;
    if (IMAGE_EXTENSIONS.some(ext => nome.endsWith(ext))) return true;
    return false;
}

function compactarArray(valor, limite = 8) {
    if (!Array.isArray(valor)) return valor;
    return valor.slice(0, limite).map((item) => {
        if (typeof item === 'string') return item.slice(0, 500);
        if (!item || typeof item !== 'object') return item;
        return Object.fromEntries(
            Object.entries(item)
                .slice(0, 12)
                .map(([key, val]) => [key, typeof val === 'string' ? val.slice(0, 300) : val])
        );
    });
}

function compactarResultadoAnalise(dados) {
    if (!dados || typeof dados !== 'object') return dados;

    const chaves = [
        'resumo',
        'alertas',
        'recomendacoes',
        'anomalias',
        'categorias',
        'itens_conciliacao',
        'receita_bruta',
        'receita_liquida',
        'deducoes',
        'custos',
        'lucro_bruto',
        'despesas_operacionais',
        'ebitda',
        'total_entradas',
        'total_saidas',
        'saldo_final',
        'lucro_liquido',
        'margem_bruta_pct',
        'margem_liquida_pct',
        'liquidez_corrente',
        'endividamento_pct'
    ];

    const compacto = {};
    chaves.forEach((key) => {
        if (dados[key] === undefined) return;
        if (typeof dados[key] === 'string') compacto[key] = dados[key].slice(0, 1200);
        else if (Array.isArray(dados[key])) compacto[key] = compactarArray(dados[key], key === 'itens_conciliacao' ? 20 : 8);
        else compacto[key] = dados[key];
    });

    return Object.keys(compacto).length ? compacto : dados;
}

async function extrairTextoPDF(buffer) {
    if (!pdfParseModule) {
        console.error('[extrairTextoPDF] pdf-parse não disponível. Texto não será extraído.');
        return '';
    }
    try {
        let data;
        if (typeof pdfParseModule === 'function') {
            data = await pdfParseModule(buffer);
        } else if (typeof pdfParseModule.default === 'function') {
            data = await pdfParseModule.default(buffer);
        } else {
            throw new Error('Versão do pdf-parse sem extrator compatível.');
        }
        return data?.text || '';
    } catch (e) {
        console.error('[extrairTextoPDF] Erro na extração:', e.message);
        return '';
    }
}

function normalizarBusca(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function encontrarTrechoContabil(texto, tipo, limite) {
    if (!texto || texto.length <= limite) return texto;

    const normalizado = normalizarBusca(texto);
    const termosPorTipo = {
        dre: [
            'demonstracao do resultado',
            'demonstracao dos resultados',
            'receitas operacionais',
            'receita liquida',
            'lucro liquido do exercicio',
            'lucro liquido',
            'resultado do exercicio',
            'ebitda',
            'despesas operacionais'
        ],
        balanco: [
            'balanco patrimonial',
            'ativo total',
            'ativo circulante',
            'passivo total',
            'passivo circulante',
            'patrimonio liquido'
        ],
        extrato: [
            'saldo anterior',
            'saldo inicial',
            'saldo final',
            'saldo disponivel',
            'historico',
            'transacoes',
            'lancamentos'
        ]
    };

    const termos = termosPorTipo[tipo] || termosPorTipo.dre;
    const candidatos = [];
    termos.forEach((termo) => {
        let pos = -1;
        while ((pos = normalizado.indexOf(termo, pos + 1)) !== -1) {
            candidatos.push(pos);
        }
    });

    if (!candidatos.length) {
        return texto.slice(0, limite);
    }

    // Escolher a primeira ocorrencia como inicio do trecho relevante
    const inicioRaw = candidatos.sort((a, b) => a - b)[0];
    const margemAnterior = 800;
    const startRaw = Math.max(0, inicioRaw - margemAnterior);

    // Expandir até o proximo termo relevante (ultima ocorrencia dentro do limite)
    const fimRaw = candidatos.filter(p => p > startRaw && p < startRaw + limite).pop() || (startRaw + limite);
    const endRaw = Math.min(texto.length, Math.max(startRaw + limite, fimRaw + 400));

    // Alinhar a cortes com quebras de linha para nao cortar no meio de uma linha/tabela
    let start = startRaw;
    while (start > 0 && texto[start - 1] !== '\n') start -= 1;

    let end = endRaw;
    while (end < texto.length && texto[end] !== '\n') end += 1;
    end = Math.min(texto.length, end);

    // Se o trecho ainda excede o limite, faz o corte mais conservador
    if (end - start > limite) {
        end = start + limite;
        while (end > start && texto[end - 1] !== '\n') end -= 1;
    }

    return texto.slice(start, end);
}

function possuiTermosContabeisMinimos(texto, tipo) {
    const n = normalizarBusca(texto);
    const mapa = {
        dre: ['receita', 'lucro', 'custo', 'despesa', 'resultado'],
        balanco: ['ativo', 'passivo', 'patrimonio', 'circulante'],
        extrato: ['saldo', 'data', 'historico', 'transacao', 'lancamento']
    };
    const termos = mapa[tipo] || mapa.dre;
    return termos.some(t => n.includes(t));
}

function extrairTextoExcel(buffer) {
    try {
        const XLSX = require('xlsx');
        const wb = XLSX.read(buffer, { type: 'buffer' });
        let texto = '';
        wb.SheetNames.forEach(name => {
            const ws = wb.Sheets[name];
            const csv = XLSX.utils.sheet_to_csv(ws);
            texto += `=== Aba: ${name} ===\n${csv}\n\n`;
        });
        return texto;
    } catch (e) {
        console.error('Excel parse error:', e.message);
        return '';
    }
}

async function uploadDocumento(req, res) {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
    const { tipo = 'dre', contexto = '' } = req.body;

    let texto = '';
    const mime = req.file.mimetype;
    const nome = req.file.originalname.toLowerCase();

    if (isImageFile(mime, nome)) {
        console.log(`[uploadDocumento] OCR em imagem: ${req.file.originalname}`);
        texto = await extrairTextoOCR(req.file.buffer);
    } else if (mime === 'application/pdf' || nome.endsWith('.pdf')) {
        texto = await extrairTextoPDF(req.file.buffer);
    } else if (nome.match(/\.(xlsx|xls|ods)$/)) {
        texto = extrairTextoExcel(req.file.buffer);
    } else {
        texto = req.file.buffer.toString('utf-8');
    }

    console.log(`[uploadDocumento] tipo=${tipo} arquivo=${req.file.originalname} tamanhoTextoExtraido=${texto.length}`);

    const textoLimpo = texto.trim();
    if (!textoLimpo) {
        return res.status(422).json({
            erro: 'Não foi possível extrair texto do documento.',
            sugestao: 'Se for um PDF digitalizado (imagem), converta-o para PNG/JPG e envie, ou use um arquivo Excel/CSV.',
            acoes: ['converter_pdf_para_imagem', 'enviar_excel']
        });
    }

    // Heuristica: menos de 100 caracteres ou quase so numeros = provavel PDF digitalizado mal extraido
    if (textoLimpo.length < 100 || textoLimpo.replace(/[\d\s.,\-/]/g, '').length < 30) {
        return res.status(422).json({
            erro: 'Texto extraido muito curto ou sem conteudo semantico.',
            sugestao: 'Verifique se o PDF esta selecionavel ou converta-o para imagem/Excel.',
            acoes: ['converter_pdf_para_imagem', 'enviar_excel']
        });
    }

    if (!possuiTermosContabeisMinimos(textoLimpo, tipo)) {
        console.warn(`[uploadDocumento] Documento ${req.file.originalname} não contém termos contábeis mínimos esperados para tipo=${tipo}`);
    }

    texto = encontrarTrechoContabil(textoLimpo, tipo, MAX_EXTRACTED_CHARS);
    console.log(`[uploadDocumento] trechoEnviadoIA=${texto.length} caracteres`);

    const analise = await analisarComGroq(tipo, texto, contexto);
    const resultadoCompacto = compactarResultadoAnalise(analise.dados);
    await salvarAnalise({
        email: req.userEmail,
        tipo,
        nomeArquivo: req.file.originalname,
        tamanho: req.file.size,
        data: new Date().toISOString(),
        resultado: resultadoCompacto,
        fonte: analise.fonte,
        confianca: analise.confianca
    });

    res.json({ sucesso: true, ...analise, dados: resultadoCompacto, nomeArquivo: req.file.originalname });
}

async function getAnalises(req, res) {
    try {
        const analises = await obterAnalises(req.userEmail);
        const compactas = analises.slice(0, MAX_ANALYSES_RETURNED).map((analise) => ({
            id: analise.id,
            tipo: analise.tipo,
            nomeArquivo: analise.nomeArquivo,
            tamanho: analise.tamanho,
            data: analise.data,
            fonte: analise.fonte,
            confianca: analise.confianca,
            resultado: compactarResultadoAnalise(analise.resultado)
        }));
        res.json({ sucesso: true, analises: compactas });
    } catch (e) {
        console.error('Erro ao obter análises:', e);
        res.status(500).json({ erro: 'Não foi possível carregar as análises.' });
    }
}

async function postChat(req, res) {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ erro: 'Mensagem obrigatória.' });
    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_KEY) return res.json({ sucesso: true, resposta: 'A análise por IA está temporariamente indisponível.', fonte: 'local' });
    try {
        const usuario = await obterUsuario(req.userEmail);
        const banks = usuario?.connectedBanks || [];
        const txSummary = banks.flatMap(b => (b.transactions || []).slice(0, 5).map(t => `${t.data}: ${t.descricao} R$${t.valor}`)).join('\n');
        const sysPrompt = `Você é o assistente financeiro FinPJ para PMEs brasileiras. Responda de forma concisa e prática em português. Dados do usuário:\n- E-mail: ${req.userEmail}\n- Bancos conectados: ${banks.length}\n- Últimas transações:\n${txSummary || 'Nenhuma'}\n${context || ''}`;
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: message }], max_tokens: 1000, temperature: 0.4 })
        });
        const payload = await resp.json();
        const content = payload?.choices?.[0]?.message?.content || 'Não consegui processar sua pergunta.';
        res.json({ sucesso: true, resposta: content, fonte: 'groq-llama3' });
    } catch (e) {
        console.error('Chat error:', e);
        res.json({ sucesso: true, resposta: 'Erro ao processar. Tente novamente.', fonte: 'error' });
    }
}

async function getUploadUrl(req, res) {
    const { filename, contentType, size } = req.body;
    if (!filename || !contentType) {
        return res.status(400).json({ erro: 'Nome do arquivo e tipo de conteúdo são obrigatórios.' });
    }
    const MAX_SIZE = 50 * 1024 * 1024;
    if (size && size > MAX_SIZE) {
        return res.status(413).json({ erro: 'Arquivo muito grande. Limite de 50 MB.' });
    }
    const { isStorageConfigured, generateUploadUrl, sanitizeFilename, R2_BUCKET_NAME } = require('../services/storageService');
    if (!isStorageConfigured()) {
        return res.status(503).json({ erro: 'Serviço de storage não configurado.', fallback: true });
    }
    const safeName = sanitizeFilename(filename);
    const key = `uploads/${Date.now()}-${req.userEmail.replace(/[^a-zA-Z0-9]/g, '_')}-${safeName}`;
    try {
        const uploadUrl = await generateUploadUrl(key, contentType, 300);
        res.json({
            sucesso: true,
            uploadUrl,
            key,
            bucket: R2_BUCKET_NAME,
            publicUrl: null,
            expiresIn: 300
        });
    } catch (e) {
        console.error('[getUploadUrl] Erro:', e.message);
        res.status(500).json({ erro: 'Erro ao gerar URL de upload.', fallback: true });
    }
}

async function processDocumentFromUrl(req, res) {
    const { key, tipo = 'dre', contexto = '', filename, size } = req.body;
    if (!key) {
        return res.status(400).json({ erro: 'Chave do arquivo é obrigatória.' });
    }
    const { isStorageConfigured, generateDownloadUrl, deleteObject } = require('../services/storageService');
    if (!isStorageConfigured()) {
        return res.status(503).json({ erro: 'Serviço de storage não configurado.' });
    }
    let texto = '';
    let downloadUrl;
    try {
        downloadUrl = await generateDownloadUrl(key, 300);
    } catch (e) {
        console.error('[processDocumentFromUrl] Erro ao gerar download URL:', e.message);
        return res.status(500).json({ erro: 'Erro ao acessar arquivo.' });
    }
    try {
        // Usar fetch nativo do Node.js 18+ (não precisa de node-fetch)
        const fileRes = await fetch(downloadUrl);
        if (!fileRes.ok) {
            throw new Error(`HTTP ${fileRes.status}`);
        }
        const buffer = Buffer.from(await fileRes.arrayBuffer());
        const nome = (filename || key).toLowerCase();
        const mime = fileRes.headers.get('content-type') || 'application/octet-stream';
        if (isImageFile(mime, nome)) {
            console.log(`[processDocumentFromUrl] OCR em imagem: ${filename || key}`);
            texto = await extrairTextoOCR(buffer);
        } else if (mime === 'application/pdf' || nome.endsWith('.pdf')) {
            texto = await extrairTextoPDF(buffer);
        } else if (nome.match(/\.(xlsx|xls|ods)$/)) {
            texto = extrairTextoExcel(buffer);
        } else {
            texto = buffer.toString('utf-8');
        }
        console.log(`[processDocumentFromUrl] tipo=${tipo} arquivo=${filename || key} tamanhoTextoExtraido=${texto.length}`);
        const textoLimpo = texto.trim();
        if (!textoLimpo) {
            await deleteObject(key).catch(() => {});
            return res.status(422).json({
                erro: 'Não foi possível extrair texto do documento.',
                sugestao: 'Se for um PDF digitalizado (imagem), converta-o para PNG/JPG e envie, ou use um arquivo Excel/CSV.',
                acoes: ['converter_pdf_para_imagem', 'enviar_excel']
            });
        }
        if (textoLimpo.length < 100 || textoLimpo.replace(/[\d\s.,\-/]/g, '').length < 30) {
            await deleteObject(key).catch(() => {});
            return res.status(422).json({
                erro: 'Texto extraído muito curto ou sem conteúdo semântico.',
                sugestao: 'Verifique se o PDF está selecionável ou converta-o para imagem/Excel.',
                acoes: ['converter_pdf_para_imagem', 'enviar_excel']
            });
        }
        if (!possuiTermosContabeisMinimos(textoLimpo, tipo)) {
            console.warn(`[processDocumentFromUrl] Documento ${filename || key} não contém termos contábeis mínimos esperados para tipo=${tipo}`);
        }
        texto = encontrarTrechoContabil(textoLimpo, tipo, MAX_EXTRACTED_CHARS);
        console.log(`[processDocumentFromUrl] trechoEnviadoIA=${texto.length} caracteres`);
        const analise = await analisarComGroq(tipo, texto, contexto);
        const resultadoCompacto = compactarResultadoAnalise(analise.dados);
        await salvarAnalise({
            email: req.userEmail,
            tipo,
            nomeArquivo: filename || key,
            tamanho: size || buffer.length,
            data: new Date().toISOString(),
            resultado: resultadoCompacto,
            fonte: analise.fonte,
            confianca: analise.confianca
        });
        await deleteObject(key).catch((e) => {
            console.warn('[processDocumentFromUrl] Falha ao deletar arquivo temporário:', e.message);
        });
        res.json({ sucesso: true, ...analise, dados: resultadoCompacto, nomeArquivo: filename || key });
    } catch (e) {
        console.error('[processDocumentFromUrl] Erro:', e.message);
        await deleteObject(key).catch(() => {});
        res.status(500).json({ erro: 'Erro ao processar documento.', detalhes: e.message });
    }
}

module.exports = {
    uploadDocumento,
    getAnalises,
    postChat,
    getUploadUrl,
    processDocumentFromUrl
};
>>>>>>> C:/Users/samue/.windsurf/worktrees/finpj/finpj-f491ab2b/src/controllers/documentController.js
