require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
    console.log('Testing SMTP connection...');
    console.log('Host:', process.env.MAIL_HOST);
    console.log('User:', process.env.MAIL_USER);
    
    const transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT) || 587,
        secure: process.env.MAIL_SECURE === 'true',
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS
        }
    });

    try {
        const info = await transporter.sendMail({
            from: process.env.MAIL_FROM,
            to: 'samuelfidelis381@gmail.com', // Enviar para você mesmo
            subject: 'Teste de Servidor SMTP - FinPJ 🚀',
            text: 'Seu servidor de e-mail está configurado e funcionando perfeitamente!',
            html: '<h3>Parabéns! 🎉</h3><p>Seu servidor SMTP do Brevo está conectado e o FinPJ já pode enviar e-mails.</p>'
        });
        console.log('✅ Sucesso! Email enviado. ID:', info.messageId);
    } catch (error) {
        console.error('❌ Erro ao enviar email:');
        console.error(error.message);
    }
}

testEmail();
