import { formatEmail, generateCode, hashCode, validateEmail, getUser, saveUser, sendVerificationEmail, generateBankReports, CODE_EXPIRY_MS } from '../lib/auth-storage.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    const { email } = req.body || {};
    if (!validateEmail(email)) {
        return res.status(400).json({ erro: 'Email inválido' });
    }

    const normalizedEmail = formatEmail(email);
    let user = await getUser(normalizedEmail);
    if (!user) {
        user = {
            email: normalizedEmail,
            createdAt: new Date().toISOString(),
            bankReports: generateBankReports(normalizedEmail)
        };
    }

    const code = generateCode();
    user.verificationCodeHash = await hashCode(code);
    user.codeExpiresAt = Date.now() + CODE_EXPIRY_MS;
    user.lastCodeSentAt = new Date().toISOString();

    await saveUser(user);
    try {
        await sendVerificationEmail(normalizedEmail, code);
    } catch (err) {
        console.error('Falha ao enviar email de verificação:', err);
    }

    return res.status(200).json({ sucesso: true, mensagem: `Código enviado para ${normalizedEmail}` });
}
