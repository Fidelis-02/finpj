const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let db;

async function conectarDB() {
    if (!db) {
        await client.connect();
        db = client.db('finpj');
    }
    return db;
}
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));  // Servir arquivos estáticos (finpj-site.html)

// Arquivo de banco de dados
const dadosFile = path.join(__dirname, 'dados.json');

// Função para ler dados
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

// Função para salvar dados
function salvarDados(dados) {
    fs.writeFileSync(dadosFile, JSON.stringify(dados, null, 2));
}

// ROTA 1: Receber diagnóstico
app.post('/api/diagnosticos', (req, res) => {
    const { nome, cnpj, setor, regime, faturamento, margem } = req.body;
    
    // Validar
    if (!nome || !cnpj) {
        return res.status(400).json({ erro: 'Nome e CNPJ são obrigatórios' });
    }
    
    // Calcular diagnóstico
    const fat = parseInt(faturamento) || 4800000;
    const marg = parseFloat(margem) || 0.12;
    
    // Impostos (simplificado)
    const impostoSimples = fat * 0.11;
    const impostoPresumido = fat * 0.15;
    const impostoReal = (fat * marg) * 0.24;
    
    const regimeIdeal = impostoSimples < impostoPresumido && impostoSimples < impostoReal 
        ? 'Simples Nacional' 
        : impostoPresumido < impostoReal 
        ? 'Lucro Presumido' 
        : 'Lucro Real';
    
    const impostoIdeal = Math.min(impostoSimples, impostoPresumido, impostoReal);
    const economia = Math.max(impostoSimples, impostoPresumido, impostoReal) - impostoIdeal;
    
    // Créditos estimados
    const creditosIdentificados = fat * 0.05;
    
    // Anomalia de custo (simulado)
    const anomaliaValor = Math.random() > 0.5 ? fat * 0.01 : 0;
    
    // Criar objeto de diagnóstico
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
    
    // Salvar no arquivo JSON
    const dados = lerDados();
    dados.diagnosticos.push(diagnostico);
    salvarDados(dados);
    
    // Responder
    res.json({
        sucesso: true,
        id: diagnostico.id,
        resultados: diagnostico.resultados
    });
});

// ROTA 2: Recuperar diagnóstico por ID
app.get('/api/diagnosticos/:id', (req, res) => {
    const { id } = req.params;
    const dados = lerDados();
    const diagnostico = dados.diagnosticos.find(d => d.id == id);
    
    if (!diagnostico) {
        return res.status(404).json({ erro: 'Diagnóstico não encontrado' });
    }
    
    res.json(diagnostico);
});

// ROTA 3: Listar todos os diagnósticos
app.get('/api/diagnosticos', (req, res) => {
    const dados = lerDados();
    res.json(dados.diagnosticos);
});

// ROTA 4: Deletar diagnóstico
app.delete('/api/diagnosticos/:id', (req, res) => {
    const { id } = req.params;
    const dados = lerDados();
    
    dados.diagnosticos = dados.diagnosticos.filter(d => d.id != id);
    salvarDados(dados);
    
    res.json({ sucesso: true, mensagem: 'Diagnóstico deletado' });
});

// ROTA 5: Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString()
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`
    ====================================
    FinPJ Backend rodando! 🚀
    ====================================
    
    Servidor em: http://localhost:${PORT}
    
    Site: http://localhost:${PORT}/finpj-site.html
    
    API disponível em: http://localhost:${PORT}/api/diagnosticos
    
    ====================================
    Pressione CTRL+C para parar
    ====================================
    `);
}); 
module.exports = app;