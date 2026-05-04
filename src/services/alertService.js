/**
 * alertService.js
 * ----------------
 * Monitora bank reports e dispara e-mails automáticos quando detecta status "Atenção".
 * Integra com emailService.js para envio via Brevo/SMTP.
 */

const { emailTransportConfigured } = require('./emailService');
const nodemailer = require('nodemailer');

const MAIL_FROM = process.env.MAIL_FROM || 'FinPJ <no-reply@finpj.com>';

// Controle de debounce: evita re-enviar alertas repetidos
const sentAlerts = new Map();
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h entre alertas iguais

function criarTransportadorEmail() {
    return nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT) || 587,
        secure: process.env.MAIL_SECURE === 'true',
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS || process.env.BREVO_API_KEY
        }
    });
}

function buildAlertHtml({ userName, alerts, dashboardUrl }) {
    const alertRows = alerts.map((alert) => `
        <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 500;">
                ${alert.title}
            </td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b;">
                ${alert.date}
            </td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; text-align: right;">
                <span style="background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;">
                    ⚠️ Atenção
                </span>
            </td>
        </tr>
    `).join('');

    return `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #f8fafc;">
            <div style="background: linear-gradient(135deg, #0f172a 0%, #dc2626 100%); padding: 28px 24px; border-radius: 16px 16px 0 0;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px;">⚠️ FinPJ — Alerta Financeiro</h1>
                <p style="margin: 8px 0 0; color: #fecaca; font-size: 14px;">Itens que requerem sua atenção imediata</p>
            </div>

            <div style="background: #ffffff; padding: 28px 24px; border: 1px solid #e2e8f0; border-top: none;">
                <p style="margin: 0 0 16px; color: #475569; line-height: 1.6;">
                    Olá${userName ? ' ' + userName : ''},
                </p>
                <p style="margin: 0 0 24px; color: #475569; line-height: 1.6;">
                    Identificamos <strong>${alerts.length}</strong> item(ns) com status <strong>"Atenção"</strong> 
                    nos seus relatórios bancários. Recomendamos revisá-los o mais breve possível.
                </p>

                <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="padding: 10px 16px; text-align: left; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Relatório</th>
                            <th style="padding: 10px 16px; text-align: left; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Data</th>
                            <th style="padding: 10px 16px; text-align: right; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${alertRows}
                    </tbody>
                </table>

                <div style="margin-top: 28px; text-align: center;">
                    <a href="${dashboardUrl}" style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 600; font-size: 15px;">
                        Acessar Dashboard
                    </a>
                </div>
            </div>

            <div style="padding: 16px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px; text-align: center;">
                <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                    Este e-mail foi enviado automaticamente pelo FinPJ. 
                    <a href="${dashboardUrl}" style="color: #3b82f6;">Gerenciar notificações</a>
                </p>
            </div>
        </div>
    `;
}

/**
 * Verifica se os bank reports de um usuário contêm alertas e envia e-mail.
 * @param {Object} usuario - Documento do usuário do MongoDB
 * @param {Object} [options] - Opções adicionais
 * @param {boolean} [options.force=false] - Ignorar cooldown de 24h
 * @returns {Promise<{sent: boolean, alertCount: number, reason?: string}>}
 */
async function verificarEEnviarAlertas(usuario, options = {}) {
    if (!usuario || !usuario.email) {
        return { sent: false, alertCount: 0, reason: 'Usuário inválido' };
    }

    if (!emailTransportConfigured()) {
        return { sent: false, alertCount: 0, reason: 'Transporte de e-mail não configurado' };
    }

    // Coletar bank reports com status "Atenção" (normalizado)
    const allReports = Array.isArray(usuario.bankReports) ? usuario.bankReports : [];

    // Também verificar bankReports em connectedBanks (se existirem reports por banco)
    const connectedBanks = Array.isArray(usuario.connectedBanks) ? usuario.connectedBanks : [];

    // Também verificar empresas
    const empresas = Array.isArray(usuario.empresas) ? usuario.empresas : [];
    empresas.forEach((empresa) => {
        if (Array.isArray(empresa.bankReports)) {
            allReports.push(...empresa.bankReports);
        }
    });

    const alertReports = allReports.filter((report) => {
        const status = String(report.status || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        return status.includes('atencao') || status.includes('atenção') || status.includes('attention');
    });

    if (alertReports.length === 0) {
        return { sent: false, alertCount: 0, reason: 'Nenhum alerta encontrado' };
    }

    // Verificar cooldown
    const cacheKey = `${usuario.email}:${alertReports.length}:${alertReports[0]?.id || ''}`;
    if (!options.force) {
        const lastSent = sentAlerts.get(cacheKey);
        if (lastSent && (Date.now() - lastSent) < ALERT_COOLDOWN_MS) {
            const remainingHours = Math.ceil((ALERT_COOLDOWN_MS - (Date.now() - lastSent)) / 3600000);
            return { sent: false, alertCount: alertReports.length, reason: `Cooldown ativo (${remainingHours}h restantes)` };
        }
    }

    // Montar e-mail
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
    const dashboardUrl = `${baseUrl}/dashboard`;
    const userName = usuario.nome || usuario.fantasia || usuario.profile?.name || '';

    const alerts = alertReports.slice(0, 10).map((report) => ({
        title: report.title || 'Relatório bancário',
        date: report.date || new Date().toISOString().slice(0, 10),
        amount: report.amount || 0
    }));

    const html = buildAlertHtml({ userName, alerts, dashboardUrl });

    const mailOptions = {
        from: MAIL_FROM,
        to: usuario.email,
        subject: `⚠️ FinPJ: ${alertReports.length} alerta(s) financeiro(s) detectado(s)`,
        text: `FinPJ detectou ${alertReports.length} item(ns) com status "Atenção" nos seus relatórios bancários. Acesse ${dashboardUrl} para revisar.`,
        html
    };

    try {
        const transport = criarTransportadorEmail();
        const result = await transport.sendMail(mailOptions);
        console.log(`📧 Alerta enviado para ${usuario.email}: ${alertReports.length} itens (${result.messageId || 'OK'})`);

        // Registrar no cooldown
        sentAlerts.set(cacheKey, Date.now());

        // Limpar cache antiga (máx 500 entries)
        if (sentAlerts.size > 500) {
            const cutoff = Date.now() - ALERT_COOLDOWN_MS;
            for (const [key, timestamp] of sentAlerts) {
                if (timestamp < cutoff) sentAlerts.delete(key);
            }
        }

        return { sent: true, alertCount: alertReports.length };
    } catch (error) {
        console.error(`❌ Erro ao enviar alerta para ${usuario.email}:`, error.message);
        return { sent: false, alertCount: alertReports.length, reason: error.message };
    }
}

/**
 * Verifica alertas para múltiplos usuários (para batch/cron).
 * @param {Array} usuarios - Lista de documentos de usuários
 * @returns {Promise<Array>} Resultados por usuário
 */
async function verificarAlertasEmLote(usuarios) {
    const results = [];
    for (const usuario of usuarios) {
        const result = await verificarEEnviarAlertas(usuario);
        results.push({ email: usuario.email, ...result });
    }
    return results;
}

module.exports = {
    verificarEEnviarAlertas,
    verificarAlertasEmLote,
    ALERT_COOLDOWN_MS
};
