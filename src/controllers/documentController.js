const { lerDados, salvarDados, obterUsuario } = require('../services/database');
const { analisarComGroq } = require('../services/aiService');

async function extrairTextoPDF(buffer) {
    try {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        return data.text || '';
    } catch (e) {
        console.error('PDF parse error:', e.message);
        return '';
    }
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

    if (mime === 'application/pdf' || nome.endsWith('.pdf')) {
        texto = await extrairTextoPDF(req.file.buffer);
    } else if (nome.match(/\.(xlsx|xls|ods)$/)) {
        texto = extrairTextoExcel(req.file.buffer);
    } else {
        texto = req.file.buffer.toString('utf-8');
    }

    if (!texto.trim()) {
        return res.status(422).json({ erro: 'Não foi possível extrair texto do documento. Tente um PDF com texto selecionável ou Excel.' });
    }

    const analise = await analisarComGroq(tipo, texto, contexto);

    const dados = lerDados();
    if (!dados.analises) dados.analises = [];
    dados.analises.push({
        id: Date.now(),
        email: req.userEmail,
        tipo,
        nomeArquivo: req.file.originalname,
        tamanho: req.file.size,
        data: new Date().toISOString(),
        resultado: analise.dados,
        fonte: analise.fonte
    });
    salvarDados(dados);

    res.json({ sucesso: true, ...analise, nomeArquivo: req.file.originalname });
}

function getAnalises(req, res) {
    const dados = lerDados();
    const analises = (dados.analises || []).filter(a => a.email === req.userEmail);
    res.json({ sucesso: true, analises });
}

async function postChat(req, res) {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ erro: 'Mensagem obrigatória.' });
    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_KEY) return res.json({ sucesso: true, resposta: 'Configure GROQ_API_KEY para usar o chat IA.', fonte: 'local' });
    try {
        const usuario = await obterUsuario(req.userEmail);
        const banks = usuario?.connectedBanks || [];
        const txSummary = banks.flatMap(b => (b.transactions || []).slice(0, 5).map(t => `${t.data}: ${t.descricao} R$${t.valor}`)).join('\n');
        const sysPrompt = `Você é o assistente financeiro FinPJ para PMEs brasileiras. Responda de forma concisa e prática em português. Dados do usuário:\n- Email: ${req.userEmail}\n- Bancos conectados: ${banks.length}\n- Últimas transações:\n${txSummary || 'Nenhuma'}\n${context || ''}`;
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: message }], max_tokens: 1000, temperature: 0.4 })
        });
        const payload = await resp.json();
        const content = payload?.choices?.[0]?.message?.content || 'Não consegui processar sua pergunta.';
        res.json({ sucesso: true, resposta: content, fonte: 'groq-llama3' });
    } catch (e) { console.error('Chat error:', e); res.json({ sucesso: true, resposta: 'Erro ao processar. Tente novamente.', fonte: 'error' }); }
}

module.exports = {
    uploadDocumento,
    getAnalises,
    postChat
};
