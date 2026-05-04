#!/usr/bin/env node
/**
 * migrate-dados-json.js
 * ---------------------
 * Migra todos os dados de `dados.json` para o MongoDB Atlas.
 *
 * Collections alvo:
 *   - usuarios  (upsert por email)
 *   - diagnosticos (upsert por id)
 *
 * Uso:
 *   node scripts/migrate-dados-json.js [--dry-run]
 *
 * Flags:
 *   --dry-run    Mostra o que seria migrado sem gravar no banco.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const DADOS_PATH = path.join(__dirname, '..', 'dados.json');
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║    FinPJ — Migração dados.json → MongoDB    ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log();

    if (DRY_RUN) {
        console.log('⚠️  Modo DRY-RUN ativado. Nenhum dado será gravado.\n');
    }

    // 1. Ler dados.json
    if (!fs.existsSync(DADOS_PATH)) {
        console.error('❌ Arquivo dados.json não encontrado em:', DADOS_PATH);
        process.exit(1);
    }

    const raw = fs.readFileSync(DADOS_PATH, 'utf-8');
    let dados;
    try {
        dados = JSON.parse(raw);
    } catch (e) {
        console.error('❌ dados.json não é JSON válido:', e.message);
        process.exit(1);
    }

    const diagnosticos = Array.isArray(dados.diagnosticos) ? dados.diagnosticos : [];
    const usuarios = Array.isArray(dados.usuarios) ? dados.usuarios : [];
    const analises = Array.isArray(dados.analises) ? dados.analises : [];

    console.log(`📋 Encontrados no dados.json:`);
    console.log(`   ├─ ${diagnosticos.length} diagnóstico(s)`);
    console.log(`   ├─ ${usuarios.length} usuário(s)`);
    console.log(`   └─ ${analises.length} análise(s)`);
    console.log();

    if (!diagnosticos.length && !usuarios.length && !analises.length) {
        console.log('⚠️  Nenhum dado para migrar. Encerrando.');
        process.exit(0);
    }

    // 2. Conectar ao MongoDB
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        console.error('❌ Variável MONGO_URI não definida no .env');
        process.exit(1);
    }

    console.log('🔌 Conectando ao MongoDB Atlas...');
    const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000
    });

    try {
        await client.connect();
        const db = client.db('finpj');
        console.log('✅ Conectado ao banco "finpj".\n');

        // 3. Migrar diagnósticos
        if (diagnosticos.length) {
            console.log('── Migrando diagnósticos ──');
            const diagColl = db.collection('diagnosticos');
            let migrated = 0;
            let skipped = 0;

            for (const diag of diagnosticos) {
                const diagId = diag.id || `diag_legacy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const filter = { id: { $in: [diagId, Number(diagId)].filter(v => v !== null && v !== undefined) } };

                if (DRY_RUN) {
                    console.log(`   [DRY] Upsert diagnóstico id=${diagId} (${diag.nome || 'sem nome'})`);
                    migrated++;
                    continue;
                }

                const existing = await diagColl.findOne(filter);
                const doc = {
                    ...diag,
                    id: diagId,
                    migratedFrom: 'dados.json',
                    migratedAt: new Date(),
                    createdAt: diag.data ? new Date(diag.data) : new Date(),
                    updatedAt: new Date()
                };

                if (existing) {
                    // Preservar ownerEmail se já existir no Mongo
                    if (existing.ownerEmail && !doc.ownerEmail) {
                        doc.ownerEmail = existing.ownerEmail;
                    }
                }

                const result = await diagColl.updateOne(
                    filter,
                    { $set: doc },
                    { upsert: true }
                );

                if (result.upsertedCount > 0) {
                    console.log(`   ✅ Inserido: id=${diagId} (${diag.nome || 'sem nome'})`);
                    migrated++;
                } else if (result.modifiedCount > 0) {
                    console.log(`   🔄 Atualizado: id=${diagId} (${diag.nome || 'sem nome'})`);
                    migrated++;
                } else {
                    console.log(`   ⏭️  Sem alteração: id=${diagId}`);
                    skipped++;
                }
            }
            console.log(`   Resultado: ${migrated} migrado(s), ${skipped} ignorado(s)\n`);
        }

        // 4. Migrar usuários
        if (usuarios.length) {
            console.log('── Migrando usuários ──');
            const userColl = db.collection('usuarios');
            let migrated = 0;
            let skipped = 0;

            for (const user of usuarios) {
                const email = (user.email || '').trim().toLowerCase();
                if (!email) {
                    console.log(`   ⚠️  Usuário sem email, ignorando (cnpj=${user.cnpj || '?'})`);
                    skipped++;
                    continue;
                }

                if (DRY_RUN) {
                    const banksCount = (user.connectedBanks || []).length;
                    const reportsCount = (user.bankReports || []).length;
                    console.log(`   [DRY] Upsert usuário email=${email} (${banksCount} bancos, ${reportsCount} reports)`);
                    migrated++;
                    continue;
                }

                const existing = await userColl.findOne({ email });

                // Merge: dados do JSON complementam o que já existe no Mongo
                const merged = {
                    ...(existing || {}),
                    ...user,
                    email,
                    migratedFrom: 'dados.json',
                    migratedAt: new Date(),
                    updatedAt: new Date()
                };

                // Preservar campos do Mongo que não devem ser sobrescritos
                if (existing) {
                    // Manter password hash e campos de auth do Mongo
                    if (existing.passwordHash) merged.passwordHash = existing.passwordHash;
                    if (existing.verificationCodeHash && !user.verificationCodeHash) {
                        merged.verificationCodeHash = existing.verificationCodeHash;
                    }
                    // Merge connectedBanks (adicionar novos, não duplicar)
                    if (existing.connectedBanks && user.connectedBanks) {
                        const existingIds = new Set((existing.connectedBanks || []).map(b => b.bankId));
                        const newBanks = (user.connectedBanks || []).filter(b => !existingIds.has(b.bankId));
                        merged.connectedBanks = [...(existing.connectedBanks || []), ...newBanks];
                    }
                    // Merge bankReports (preferir os mais novos)
                    if (existing.bankReports && user.bankReports) {
                        const existingReportIds = new Set((existing.bankReports || []).map(r => r.id));
                        const newReports = (user.bankReports || []).filter(r => !existingReportIds.has(r.id));
                        merged.bankReports = [...(existing.bankReports || []), ...newReports];
                    }
                }

                // Normalizar CNPJ se presente
                if (merged.cnpj) {
                    merged.cnpj = String(merged.cnpj).replace(/\D/g, '');
                }

                // Remover _id para evitar conflitos no upsert
                delete merged._id;

                const result = await userColl.updateOne(
                    { email },
                    { $set: merged },
                    { upsert: true }
                );

                if (result.upsertedCount > 0) {
                    console.log(`   ✅ Inserido: ${email}`);
                    migrated++;
                } else if (result.modifiedCount > 0) {
                    console.log(`   🔄 Atualizado: ${email}`);
                    migrated++;
                } else {
                    console.log(`   ⏭️  Sem alteração: ${email}`);
                    skipped++;
                }
            }
            console.log(`   Resultado: ${migrated} migrado(s), ${skipped} ignorado(s)\n`);
        }

        // 5. Migrar análises (se existirem)
        if (analises.length) {
            console.log('── Migrando análises ──');
            const analiseColl = db.collection('analises');
            let migrated = 0;

            for (const analise of analises) {
                const analiseId = analise.id || `anal_legacy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

                if (DRY_RUN) {
                    console.log(`   [DRY] Upsert análise id=${analiseId}`);
                    migrated++;
                    continue;
                }

                delete analise._id;
                const result = await analiseColl.updateOne(
                    { id: analiseId },
                    {
                        $set: {
                            ...analise,
                            id: analiseId,
                            migratedFrom: 'dados.json',
                            migratedAt: new Date(),
                            updatedAt: new Date()
                        }
                    },
                    { upsert: true }
                );

                if (result.upsertedCount > 0 || result.modifiedCount > 0) {
                    migrated++;
                }
            }
            console.log(`   Resultado: ${migrated} migrada(s)\n`);
        }

        // 6. Resumo
        console.log('═══════════════════════════════════════');
        if (DRY_RUN) {
            console.log('🏁 Dry-run concluído. Execute sem --dry-run para gravar.');
        } else {
            console.log('🏁 Migração concluída com sucesso!');
            console.log('💡 Você pode renomear dados.json para dados.json.bak como backup.');
        }
        console.log('═══════════════════════════════════════');

    } catch (error) {
        console.error('❌ Erro durante migração:', error.message);
        process.exit(1);
    } finally {
        await client.close();
    }
}

main();
