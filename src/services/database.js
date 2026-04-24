const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
let mongoClient = null;
let db = null;

async function conectarDB() {
    if (db) return db;

    if (!uri) {
        throw new Error('A variável de ambiente MONGO_URI é obrigatória. Configure-a na Vercel.');
    }

    try {
        if (!mongoClient) {
            mongoClient = new MongoClient(uri, {
                serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 5000),
                connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 5000)
            });
        }
        await mongoClient.connect();
        db = mongoClient.db('finpj');
        console.log('MongoDB Atlas conectado.');

        try {
            await db.collection('usuarios').createIndex({ cnpj: 1 }, { unique: true, sparse: true });
            await db.collection('usuarios').createIndex({ email: 1 }, { unique: true });
            await db.collection('diagnosticos').createIndex({ ownerEmail: 1, createdAt: -1 });
            await db.collection('analises').createIndex({ email: 1, createdAt: -1 });
            await db.collection('users').createIndex({ email: 1 }, { unique: true });
            await db.collection('users').createIndex({ id: 1 }, { unique: true });
            await db.collection('sessions').createIndex({ id: 1 }, { unique: true });
            await db.collection('sessions').createIndex({ userId: 1, issuedAt: -1 });
            await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
            await db.collection('onboarding_state').createIndex({ userId: 1 }, { unique: true });
            await db.collection('onboarding_state').createIndex({ email: 1 });
        } catch (e) {
            // Índices já existem.
        }

        return db;
    } catch (e) {
        console.error('Erro ao conectar no MongoDB:', e.message);
        throw e;
    }
}

function formatarEmail(email) {
    return String(email || '').trim().toLowerCase();
}

async function obterUsuario(email) {
    const emailNorm = formatarEmail(email);
    if (!emailNorm) return null;
    const database = await conectarDB();
    return database.collection('usuarios').findOne({ email: emailNorm });
}

async function obterUsuarioPorCnpj(cnpj) {
    const cnpjNorm = String(cnpj || '').replace(/\D/g, '');
    if (!cnpjNorm) return null;
    const database = await conectarDB();
    return database.collection('usuarios').findOne({ cnpj: cnpjNorm });
}

async function salvarUsuario(usuario) {
    if (!usuario || !usuario.email) {
        throw new Error('Usuário inválido: e-mail é obrigatório.');
    }

    usuario.email = formatarEmail(usuario.email);
    usuario.updatedAt = new Date();
    const database = await conectarDB();
    await database.collection('usuarios').updateOne(
        { email: usuario.email },
        { $set: usuario },
        { upsert: true }
    );
    return usuario;
}

async function salvarDiagnostico(diagnostico) {
    const database = await conectarDB();
    diagnostico.createdAt = diagnostico.createdAt || new Date();
    diagnostico.updatedAt = new Date();

    if (!diagnostico.id) {
        diagnostico.id = `diag_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }

    await database.collection('diagnosticos').updateOne(
        { id: diagnostico.id },
        { $set: diagnostico },
        { upsert: true }
    );

    return diagnostico;
}

async function obterDiagnosticos(ownerEmail) {
    const database = await conectarDB();
    const filtro = ownerEmail ? { ownerEmail: formatarEmail(ownerEmail) } : {};
    return database.collection('diagnosticos').find(filtro).sort({ createdAt: -1 }).toArray();
}

async function obterDiagnostico(id, ownerEmail) {
    const database = await conectarDB();
    const ids = [id];
    const numericId = Number(id);
    if (Number.isFinite(numericId)) ids.push(numericId);
    const filtro = { id: { $in: ids } };
    if (ownerEmail) filtro.ownerEmail = formatarEmail(ownerEmail);
    return database.collection('diagnosticos').findOne(filtro);
}

async function deletarDiagnostico(id, ownerEmail) {
    const database = await conectarDB();
    const ids = [id];
    const numericId = Number(id);
    if (Number.isFinite(numericId)) ids.push(numericId);
    const filtro = { id: { $in: ids } };
    if (ownerEmail) filtro.ownerEmail = formatarEmail(ownerEmail);
    const result = await database.collection('diagnosticos').deleteOne(filtro);
    return result.deletedCount > 0;
}

async function salvarAnalise(analise) {
    const database = await conectarDB();
    analise.email = formatarEmail(analise.email);
    analise.createdAt = analise.createdAt || new Date();
    analise.updatedAt = new Date();

    if (!analise.id) {
        analise.id = `anal_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }

    await database.collection('analises').updateOne(
        { id: analise.id },
        { $set: analise },
        { upsert: true }
    );

    return analise;
}

async function obterAnalises(email) {
    const database = await conectarDB();
    return database.collection('analises').find({ email: formatarEmail(email) }).sort({ createdAt: -1 }).toArray();
}

async function deletarAnalise(id) {
    const database = await conectarDB();
    const result = await database.collection('analises').deleteOne({ id });
    return result.deletedCount > 0;
}

module.exports = {
    conectarDB,
    obterUsuario,
    obterUsuarioPorCnpj,
    salvarUsuario,
    formatarEmail,
    salvarDiagnostico,
    obterDiagnosticos,
    obterDiagnostico,
    deletarDiagnostico,
    salvarAnalise,
    obterAnalises,
    deletarAnalise
};
