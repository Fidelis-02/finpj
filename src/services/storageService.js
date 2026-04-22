const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'finpj-documents';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

let s3Client = null;

function getS3Client() {
    if (!s3Client) {
        if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
            throw new Error('Configuração R2/S3 incompleta. Verifique as variáveis de ambiente.');
        }
        s3Client = new S3Client({
            region: 'auto',
            endpoint: R2_ENDPOINT,
            credentials: {
                accessKeyId: R2_ACCESS_KEY_ID,
                secretAccessKey: R2_SECRET_ACCESS_KEY
            }
        });
    }
    return s3Client;
}

function isStorageConfigured() {
    return !!(R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

async function generateUploadUrl(key, contentType, expiresIn = 300) {
    const client = getS3Client();
    const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType
    });
    return getSignedUrl(client, command, { expiresIn });
}

async function generateDownloadUrl(key, expiresIn = 300) {
    const client = getS3Client();
    const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key
    });
    return getSignedUrl(client, command, { expiresIn });
}

async function deleteObject(key) {
    const client = getS3Client();
    const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key
    });
    return client.send(command);
}

function getPublicUrl(key) {
    if (R2_PUBLIC_URL) {
        return `${R2_PUBLIC_URL}/${key}`;
    }
    return `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${key}`;
}

function sanitizeFilename(filename) {
    return filename
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .toLowerCase();
}

module.exports = {
    isStorageConfigured,
    generateUploadUrl,
    generateDownloadUrl,
    deleteObject,
    getPublicUrl,
    sanitizeFilename,
    R2_BUCKET_NAME
};
