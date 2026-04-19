const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');
const uri = process.env.MONGO_URI;
let mongoClient = null;
let db = null;

async function conectarDB() {
    if (!uri) return null;
    if (!mongoClient) {
        mongoClient = new MongoClient(uri);
        await mongoClient.connect();
        db = mongoClient.db('finpj');
    }
    return db;
}

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

// ===============================
// CACHE DE CNPJ (performance)
// ===============================
const cacheCNPJ = {};

const FETCH_HEADERS = {
    'User-Agent': 'FinPJ/1.0 (https://github.com/finpj-app; contato comercial)',
    Accept: 'application/json'
};

function timeoutSignal(ms) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        return AbortSignal.timeout(ms);
    }
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), ms);
    return ctrl.signal;
}

function parseJsonBody(text) {
    const t = String(text || '').trim();
    if (!t || t.startsWith('<') || t.toLowerCase().includes('forbidden')) return null;
    try {
        return JSON.parse(t);
    } catch {
        return null;
    }
}

function mapBrasilApiCnpj(data) {
    if (!data || typeof data !== 'object') return null;
    if (data.type === 'bad_request') return null;
    if (!data.razao_social && !data.cnpj) return null;

    const situacao = String(data.descricao_situacao_cadastral || '').toUpperCase();
    const situacaoNum = String(data.codigo_situacao_cadastral || '');
    const ativo =
        situacao.includes('ATIV') ||
        situacaoNum === '02' ||
        situacaoNum === '2';

    return {
        ativo,
        nome: data.razao_social || '',
        fantasia: data.nome_fantasia || '',
        uf: data.uf,
        municipio: data.municipio,
        cnae_fiscal: data.cnae_fiscal != null ? String(data.cnae_fiscal) : '',
        cnae_descricao: data.cnae_fiscal_descricao || '',
        cnae: data.cnae_fiscal_descricao || '',
        fonte: 'brasilapi'
    };
}

function mapReceitaWsCnpj(data) {
    if (!data || typeof data !== 'object') return null;
    if (data.status === 'ERROR') return null;

    const ap = Array.isArray(data.atividade_principal) ? data.atividade_principal[0] : null;
    const codeRaw = ap && ap.code ? String(ap.code) : '';
    const cnaeDigits = codeRaw.replace(/\D/g, '').slice(0, 7);

    const situacao = String(data.situacao || '').toUpperCase();
    const ativo = situacao.includes('ATIV');

    return {
        ativo,
        nome: data.nome || '',
        fantasia: data.fantasia || '',
        uf: data.uf,
        municipio: data.municipio,
        cnae_fiscal: cnaeDigits || '',
        cnae_descricao: ap && ap.text ? ap.text : '',
        cnae: ap && ap.text ? ap.text : '',
        fonte: 'receitaws'
    };
}

async function consultarCnpjBrasilApi(cnpj) {
    const url = `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;
    const response = await fetch(url, {
        headers: FETCH_HEADERS,
        signal: timeoutSignal(14000)
    });
    const text = await response.text();
    const data = parseJsonBody(text);
    if (!data) {
        return { ok: false, status: response.status, data: null };
    }
    const mapped = mapBrasilApiCnpj(data);
    if (response.ok && mapped) {
        return { ok: true, mapped };
    }
    return { ok: false, status: response.status, data };
}

async function consultarCnpjReceitaWs(cnpj) {
    const url = `https://www.receitaws.com.br/v1/cnpj/${cnpj}`;
    const response = await fetch(url, {
        headers: FETCH_HEADERS,
        signal: timeoutSignal(20000)
    });
    const text = await response.text();
    const data = parseJsonBody(text);
    if (!data) return { ok: false };
    const mapped = mapReceitaWsCnpj(data);
    if (mapped) return { ok: true, mapped };
    const msg = data.message || 'CNPJ não encontrado';
    return { ok: false, erro: msg };
}

// ===============================
// ROTA CNPJ (BrasilAPI + fallback ReceitaWS)
// ===============================
app.get('/api/cnpj', async (req, res) => {
    const cnpj = (req.query.cnpj || '').replace(/\D/g, '');

    if (cnpj.length !== 14) {
        return res.status(400).json({ erro: 'CNPJ inválido' });
    }

    if (cacheCNPJ[cnpj]) {
        return res.json(cacheCNPJ[cnpj]);
    }

    try {
        const b = await consultarCnpjBrasilApi(cnpj);
        if (b.ok && b.mapped) {
            cacheCNPJ[cnpj] = b.mapped;
            return res.json(b.mapped);
        }

        const r = await consultarCnpjReceitaWs(cnpj);
        if (r.ok && r.mapped) {
            cacheCNPJ[cnpj] = r.mapped;
            return res.json(r.mapped);
        }

        const msg =
            (b.data && b.data.message) ||
            r.erro ||
            'Não foi possível localizar este CNPJ nas bases públicas.';
        return res.status(404).json({ ativo: false, erro: msg });
    } catch (err) {
        console.error(err);
        const detalhe = err && err.name === 'AbortError' ? 'Tempo esgotado ao consultar o CNPJ.' : 'Falha de rede ao consultar o CNPJ.';
        return res.status(502).json({ erro: detalhe });
    }
});

// ===============================
// BANCO LOCAL JSON
// ===============================
const dadosFile = path.join(__dirname, 'dados.json');

function lerDados() {
    try {
        if (fs.existsSync(dadosFile)) {
            const conteudo = fs.readFileSync(dadosFile, 'utf-8');
            return JSON.parse(conteudo);
        }
    } catch (e) {
        console.log('Criando novo arquivo de dados...');
    }
    return { diagnosticos: [] };
}

function salvarDados(dados) {
    fs.writeFileSync(dadosFile, JSON.stringify(dados, null, 2));
}

// ===============================
// ROTA 1: DIAGNÓSTICO
// ===============================
app.post('/api/diagnosticos', (req, res) => {
    const { nome, cnpj, setor, regime, faturamento, margem } = req.body;

    if (!nome || !cnpj) {
        return res.status(400).json({ erro: 'Nome e CNPJ são obrigatórios' });
    }

    const fat = parseInt(faturamento) || 4800000;
    const marg = parseFloat(margem) || 0.12;

    const impostoSimples = fat * 0.11;
    const impostoPresumido = fat * 0.15;
    const impostoReal = (fat * marg) * 0.24;

    const regimeIdeal =
        impostoSimples < impostoPresumido && impostoSimples < impostoReal
            ? 'Simples Nacional'
            : impostoPresumido < impostoReal
            ? 'Lucro Presumido'
            : 'Lucro Real';

    const impostoIdeal = Math.min(impostoSimples, impostoPresumido, impostoReal);
    const economia = Math.max(impostoSimples, impostoPresumido, impostoReal) - impostoIdeal;

    const creditosIdentificados = fat * 0.05;
    const anomaliaValor = Math.random() > 0.5 ? fat * 0.01 : 0;

    const diagnostico = {
        id: Date.now(),
        nome,
        cnpj,
        setor,
        regime,
        faturamento: fat,
        margem: marg,
        data: new Date().toISOString(),
        resultados: {
            regimeIdeal,
            impostoIdeal: Math.round(impostoIdeal),
            economia: Math.round(economia),
            creditosIdentificados: Math.round(creditosIdentificados),
            anomaliaValor: Math.round(anomaliaValor),
            impostos: {
                simples: Math.round(impostoSimples),
                presumido: Math.round(impostoPresumido),
                real: Math.round(impostoReal)
            }
        }
    };

    const dados = lerDados();
    dados.diagnosticos.push(diagnostico);
    salvarDados(dados);

    res.json({
        sucesso: true,
        id: diagnostico.id,
        resultados: diagnostico.resultados
    });
});

// ===============================
// ROTA 2: GET POR ID
// ===============================
app.get('/api/diagnosticos/:id', (req, res) => {
    const { id } = req.params;
    const dados = lerDados();
    const diagnostico = dados.diagnosticos.find(d => d.id == id);

    if (!diagnostico) {
        return res.status(404).json({ erro: 'Diagnóstico não encontrado' });
    }

    res.json(diagnostico);
});

// ===============================
// ROTA 3: LISTAR
// ===============================
app.get('/api/diagnosticos', (req, res) => {
    const dados = lerDados();
    res.json(dados.diagnosticos);
});

// ===============================
// ROTA 4: DELETE
// ===============================
app.delete('/api/diagnosticos/:id', (req, res) => {
    const { id } = req.params;
    const dados = lerDados();

    dados.diagnosticos = dados.diagnosticos.filter(d => d.id != id);
    salvarDados(dados);

    res.json({ sucesso: true });
});

// ===============================
// HEALTH CHECK
// ===============================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString()
    });
});

// ===============================
// START
// ===============================
app.listen(PORT, () => {
    console.log(`
====================================
FinPJ Backend rodando 🚀
====================================

http://localhost:${PORT}
http://localhost:${PORT}/finpj-site.html

====================================
`);
});

module.exports = app;