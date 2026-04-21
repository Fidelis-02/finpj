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

const isVercel = !!process.env.VERCEL;
const dadosFileSrc = path.join(process.cwd(), 'dados.json');
const dadosFile = isVercel ? '/tmp/dados.json' : dadosFileSrc;

function garantirDadosNoTmp() {
    if (isVercel && !fs.existsSync(dadosFile)) {
        try {
            if (fs.existsSync(dadosFileSrc)) {
                fs.copyFileSync(dadosFileSrc, dadosFile);
            } else {
                fs.writeFileSync(dadosFile, JSON.stringify({ diagnosticos: [], usuarios: [], bankReports: [], analises: [] }, null, 2));
            }
        } catch (e) {
            console.error('Erro ao criar dados.json em /tmp:', e.message);
        }
    }
}
garantirDadosNoTmp();

function lerDados() {
    try {
        garantirDadosNoTmp();
        if (fs.existsSync(dadosFile)) {
            const conteudo = fs.readFileSync(dadosFile, 'utf-8');
            const parsed = JSON.parse(conteudo);
            return {
                diagnosticos: parsed.diagnosticos || [],
                usuarios: parsed.usuarios || [],
                bankReports: parsed.bankReports || [],
                analises: parsed.analises || []
            };
        }
    } catch (e) {
        console.log('Criando novo arquivo de dados...');
    }
    return { diagnosticos: [], usuarios: [], bankReports: [], analises: [] };
}

function salvarDados(dados) {
    try {
        fs.writeFileSync(dadosFile, JSON.stringify(dados, null, 2));
    } catch (e) {
        console.error('Erro ao salvar dados:', e.message);
    }
}

function formatarEmail(email) {
    return String(email || '').trim().toLowerCase();
}

async function obterUsuario(email) {
    const emailNorm = formatarEmail(email);
    if (!db && uri) {
        await conectarDB();
    }
    if (db) {
        const usuario = await db.collection('usuarios').findOne({ email: emailNorm });
        if (usuario) return usuario;
    }
    const dados = lerDados();
    return dados.usuarios.find(u => u.email === emailNorm);
}

async function obterUsuarioPorCnpj(cnpj) {
    const cnpjNorm = String(cnpj || '').replace(/\D/g, '');
    if (!db && uri) {
        await conectarDB();
    }
    if (db) {
        const usuario = await db.collection('usuarios').findOne({ cnpj: cnpjNorm });
        if (usuario) return usuario;
    }
    const dados = lerDados();
    return dados.usuarios.find(u => u.cnpj === cnpjNorm);
}

async function salvarUsuario(usuario) {
    usuario.email = formatarEmail(usuario.email);
    if (!db && uri) {
        await conectarDB();
    }
    if (db) {
        await db.collection('usuarios').updateOne({ email: usuario.email }, { $set: usuario }, { upsert: true });
        return usuario;
    }
    const dados = lerDados();
    const index = dados.usuarios.findIndex(u => u.email === usuario.email);
    if (index >= 0) {
        dados.usuarios[index] = usuario;
    } else {
        dados.usuarios.push(usuario);
    }
    salvarDados(dados);
    return usuario;
}

module.exports = {
    conectarDB,
    lerDados,
    salvarDados,
    obterUsuario,
    obterUsuarioPorCnpj,
    salvarUsuario,
    formatarEmail
};
