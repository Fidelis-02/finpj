const nodemailer = require('nodemailer');

const MAIL_FROM = process.env.MAIL_FROM || 'FinPJ <no-reply@finpj.com>';

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

module.exports = {
    enviarEmailVerificacao
};
