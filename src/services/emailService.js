const nodemailer = require('nodemailer');

const MAIL_FROM = process.env.MAIL_FROM || 'FinPJ <no-reply@finpj.com>';

function emailTransportConfigured() {
    return Boolean(
        process.env.MAIL_HOST
        && process.env.MAIL_USER
        && (process.env.MAIL_PASS || process.env.BREVO_API_KEY)
    );
}

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

async function enviarEmailVerificacao(email, code) {
    const transport = criarTransportadorEmail();
    const mailOptions = {
        from: MAIL_FROM,
        to: email,
        subject: 'Seu código de acesso FinPJ',
        text: `Seu código FinPJ é: ${code}\nUse-o em até 10 minutos para continuar.`,
        html: `
            <div style="font-family: Montserrat, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #0A2540 0%, #1D74F2 100%); padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #FFFFFF; margin: 0; font-size: 24px;">FinPJ</h1>
                </div>
                <h2 style="color: #0A2540; margin-bottom: 16px;">Seu código de acesso</h2>
                <p style="color: #5A6B7D; line-height: 1.6; margin-bottom: 20px;">
                    Use o código abaixo para acessar sua conta FinPJ. Ele expira em 10 minutos.
                </p>
                <div style="background: #F0F5FF; border: 2px solid #1D74F2; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                    <p style="font-size: 36px; font-weight: 700; letter-spacing: 4px; color: #1D74F2; margin: 0;">${code}</p>
                </div>
                <p style="color: #5A6B7D; font-size: 12px; margin-bottom: 24px;">
                    Se você não solicitou este código, ignore este e-mail.
                </p>
                <div style="border-top: 1px solid #D9E2F0; padding-top: 16px; color: #8B95A7; font-size: 12px; text-align: center;">
                    <p style="margin: 0;">© 2024 FinPJ. Todos os direitos reservados.</p>
                </div>
            </div>
        `
    };
    
    try {
        const result = await transport.sendMail(mailOptions);
        console.log('✅ Email enviado com sucesso:', result.messageId || result);
        return result;
    } catch (error) {
        console.error('❌ Erro ao enviar email:', error.message);
        if (process.env.NODE_ENV === 'production') {
            throw error;
        }
        console.log(`📌 Código para ${email}: ${code}`);
    }
}

function buildHtmlShell({ title, intro, ctaLabel, ctaUrl, fallbackUrl, secondaryCopy = '' }) {
    return `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; color: #0f172a;">
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%); padding: 28px 24px; border-radius: 16px 16px 0 0;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px;">FinPJ</h1>
                <p style="margin: 8px 0 0; color: #cbd5e1; font-size: 14px;">Inteligência financeira e tributária para PMEs</p>
            </div>
            <div style="background: #ffffff; padding: 28px 24px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
                <h2 style="margin: 0 0 16px; color: #0f172a; font-size: 22px;">${title}</h2>
                <p style="margin: 0 0 20px; color: #475569; line-height: 1.6;">${intro}</p>
                <a href="${ctaUrl}" style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; padding: 14px 20px; border-radius: 12px; font-weight: 600;">${ctaLabel}</a>
                <p style="margin: 20px 0 8px; color: #475569; line-height: 1.6;">Se o botão não funcionar, copie e cole este link no navegador:</p>
                <p style="margin: 0 0 16px; word-break: break-all; color: #1d4ed8;">${fallbackUrl}</p>
                ${secondaryCopy ? `<p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6;">${secondaryCopy}</p>` : ''}
            </div>
        </div>
    `;
}

async function enviarEmailVerificacaoCadastro(email, verificationUrl) {
    const transport = criarTransportadorEmail();
    const mailOptions = {
        from: MAIL_FROM,
        to: email,
        subject: 'Confirme seu e-mail na FinPJ',
        text: [
            'Confirme seu e-mail para continuar o cadastro na FinPJ.',
            '',
            `Abra este link: ${verificationUrl}`,
            '',
            'Se você não criou uma conta, ignore este e-mail.'
        ].join('\n'),
        html: buildHtmlShell({
            title: 'Confirme seu e-mail',
            intro: 'Falta só um passo para ativar sua conta e continuar o onboarding na FinPJ.',
            ctaLabel: 'Confirmar e-mail',
            ctaUrl: verificationUrl,
            fallbackUrl: verificationUrl,
            secondaryCopy: 'Este link expira automaticamente por segurança.'
        })
    };

    try {
        return await transport.sendMail(mailOptions);
    } catch (error) {
        console.error('Erro ao enviar e-mail de verificação de cadastro:', error.message);
        if (process.env.NODE_ENV === 'production') {
            throw error;
        }
        console.log(`LINK DE VERIFICACAO PARA ${email}: ${verificationUrl}`);
        return null;
    }
}

async function enviarEmailRecuperacaoSenha(email, resetUrl) {
    const transport = criarTransportadorEmail();
    const mailOptions = {
        from: MAIL_FROM,
        to: email,
        subject: 'Redefina sua senha da FinPJ',
        text: [
            'Recebemos um pedido para redefinir sua senha da FinPJ.',
            '',
            `Abra este link: ${resetUrl}`,
            '',
            'Se você não fez esse pedido, ignore este e-mail.'
        ].join('\n'),
        html: buildHtmlShell({
            title: 'Redefina sua senha',
            intro: 'Use o link abaixo para criar uma nova senha e retomar o acesso à sua conta.',
            ctaLabel: 'Criar nova senha',
            ctaUrl: resetUrl,
            fallbackUrl: resetUrl,
            secondaryCopy: 'Se você não pediu a redefinição, ignore este e-mail. Sua senha atual continuará válida.'
        })
    };

    try {
        return await transport.sendMail(mailOptions);
    } catch (error) {
        console.error('Erro ao enviar e-mail de recuperação de senha:', error.message);
        if (process.env.NODE_ENV === 'production') {
            throw error;
        }
        console.log(`LINK DE RESET PARA ${email}: ${resetUrl}`);
        return null;
    }
}

module.exports = {
    emailTransportConfigured,
    enviarEmailVerificacao,
    enviarEmailVerificacaoCadastro,
    enviarEmailRecuperacaoSenha
};
