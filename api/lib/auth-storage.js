const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

const dadosFile = path.join(__dirname, '../../dados.json');

function lerDados() {
    try {
        if (fs.existsSync(dadosFile)) {
            const conteudo = fs.readFileSync(dadosFile, 'utf-8');
            const parsed = JSON.parse(conteudo);
            return {
                diagnosticos: parsed.diagnosticos || [],
                usuarios: parsed.usuarios || [],
                bankReports: parsed.bankReports || []
            };
        }
    } catch (e) {
        console.log('Criando novo arquivo de dados...');
    }
    return { diagnosticos: [], usuarios: [], bankReports: [] };
}

function salvarDados(dados) {
    fs.writeFileSync(dadosFile, JSON.stringify(dados, null, 2));
}

function formatarEmail(email) {
    return String(email || '').trim().toLowerCase();
}

async function obterUsuario(email) {
    const emailNorm = formatarEmail(email);
    const dados = lerDados();
    return dados.usuarios.find(u => u.email === emailNorm);
}

async function obterUsuarioPorCnpj(cnpj) {
    const cnpjNorm = String(cnpj || '').replace(/\D/g, '');
    const dados = lerDados();
    return dados.usuarios.find(u => u.cnpj === cnpjNorm);
}

async function salvarUsuario(usuario) {
    usuario.email = formatarEmail(usuario.email);
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

function gerarRelatorioBancario(email) {
    const hoje = new Date();
    const tipos = [
        'Conciliação de extrato',
        'Revisão de lançamentos',
        'Atualização de saldo',
        'Alerta de fluxo de caixa',
        'Análise de recebimentos',
        'Detectamos uma diferença bancária'
    ];
    return Array.from({ length: 6 }, (_, i) => {
        const data = new Date(hoje);
        data.setDate(hoje.getDate() - i);
        const valor = Math.round((Math.random() * 18 + 3) * 1000);
        return {
            id: `${email}-${data.toISOString().slice(0, 10)}-${i}`,
            date: data.toISOString().slice(0, 10),
            title: tipos[i % tipos.length],
            detail: `Atualização diária para a empresa ${email.split('@')[0]} com informações de extrato e movimentações bancárias.`,
            amount: valor,
            status: i % 2 === 0 ? 'Concluído' : 'Atenção'
        };
    });
}

function montarDashboard(usuario) {
    const safeUser = {
        email: usuario.email,
        createdAt: usuario.createdAt,
        lastLogin: usuario.lastLogin || usuario.createdAt
    };
    const reports = usuario.bankReports && usuario.bankReports.length ? usuario.bankReports : gerarRelatorioBancario(usuario.email);
    usuario.bankReports = reports;
    salvarUsuario(usuario);
    const totalMovimentado = reports.reduce((sum, item) => sum + item.amount, 0);
    return {
        user: safeUser,
        summary: {
            reportsCount: reports.length,
            totalMovimentado,
            pendencias: reports.filter(r => r.status !== 'Concluído').length
        },
        reports
    };
}

async function hashCode(code) {
    return await bcrypt.hash(String(code), 10);
}

async function compareCode(code, hash) {
    return await bcrypt.compare(String(code), hash);
}

module.exports = {
    obterUsuario,
    obterUsuarioPorCnpj,
    salvarUsuario,
    gerarRelatorioBancario,
    montarDashboard,
    hashCode,
    compareCode,
    formatarEmail
};
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

const STORAGE_FILE = path.join(process.cwd(), 'dados.json');
export const JWT_SECRET = process.env.JWT_SECRET || 'finpj-secret-default';
export const MAIL_FROM = process.env.MAIL_FROM || 'FinPJ <no-reply@finpj.com>';
export const CODE_EXPIRY_MS = 10 * 60 * 1000;

function readStorage() {
    try {
        if (fs.existsSync(STORAGE_FILE)) {
            const content = fs.readFileSync(STORAGE_FILE, 'utf-8');
            return JSON.parse(content);
        }
    } catch {
        // ignore and recreate storage file if invalid
    }
    return { diagnosticos: [], usuarios: [], bankReports: [] };
}

function writeStorage(data) {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
}

function createTransporter() {
    if (process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS) {
        return nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            port: Number(process.env.MAIL_PORT) || 587,
            secure: process.env.MAIL_SECURE === 'true',
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS
            }
        });
    }

    return nodemailer.createTransport({ jsonTransport: true });
}

export async function sendVerificationEmail(email, code) {
    const transport = createTransporter();
    await transport.sendMail({
        from: MAIL_FROM,
        to: email,
        subject: 'Seu código de acesso FinPJ',
        text: `Seu código FinPJ é: ${code}. Use-o em até 10 minutos para continuar.`,
        html: `<p>Seu código FinPJ é: <strong>${code}</strong></p><p>Use-o em até 10 minutos para continuar.</p>`
    });
}

export function validateEmail(email) {
    return typeof email === 'string' && email.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function formatEmail(email) {
    return String(email || '').trim().toLowerCase();
}

export function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

export async function hashCode(code) {
    return bcrypt.hash(code, 10);
}

export async function compareCode(code, hash) {
    return bcrypt.compare(String(code), hash);
}

export async function getUser(email) {
    const normalized = formatEmail(email);
    const storage = readStorage();
    return storage.usuarios.find(u => u.email === normalized);
}

export async function getUserByCnpj(cnpj) {
    const storage = readStorage();
    return storage.usuarios.find(u => u.cnpj === cnpj);
}

export async function saveUser(user) {
    const normalized = formatEmail(user.email);
    user.email = normalized;
    const storage = readStorage();
    const index = storage.usuarios.findIndex(u => u.email === normalized || u.cnpj === user.cnpj);
    if (index >= 0) {
        storage.usuarios[index] = user;
    } else {
        storage.usuarios.push(user);
    }
    writeStorage(storage);
    return user;
}

export function generateBankReports(email) {
    const today = new Date();
    const types = [
        'Conciliação de extrato',
        'Revisão de lançamentos',
        'Atualização de saldo',
        'Alerta de fluxo de caixa',
        'Recebimento confirmado',
        'Diferença identificada'
    ];
    return Array.from({ length: 6 }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() - index);
        const amount = Math.round((Math.random() * 20 + 2) * 1000);
        return {
            id: `${email}-${date.toISOString().slice(0, 10)}-${index}`,
            date: date.toISOString().slice(0, 10),
            title: types[index % types.length],
            detail: `Atualização diária para ${email.split('@')[0]} baseada em relatório bancário.`,
            amount,
            status: index % 2 === 0 ? 'Concluído' : 'Atenção'
        };
    });
}

export function mountDashboard(user) {
    const reports = user.bankReports && user.bankReports.length ? user.bankReports : generateBankReports(user.email);
    user.bankReports = reports;
    saveUser(user);
    return {
        user: {
            email: user.email,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin || user.createdAt
        },
        summary: {
            reportsCount: reports.length,
            totalMovimentado: reports.reduce((sum, item) => sum + item.amount, 0),
            pendencias: reports.filter(item => item.status !== 'Concluído').length
        },
        reports
    };
}

export function extractBearerToken(req) {
    const authorization = req.headers.authorization || req.headers.Authorization;
    if (!authorization || typeof authorization !== 'string') return null;
    const parts = authorization.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
    return parts[1];
}

export function verifyToken(req) {
    const token = extractBearerToken(req);
    if (!token) return null;
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}
