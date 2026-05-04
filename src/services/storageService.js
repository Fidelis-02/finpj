const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'finpj-documents';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Threshold for multipart upload (5 MB)
const MULTIPART_THRESHOLD = 5 * 1024 * 1024;

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

/**
 * Upload a buffer directly to R2 (server-side).
 * Supports files larger than 4.5MB by bypassing Vercel body limits.
 * For files > 5MB, uses @aws-sdk/lib-storage for multipart upload.
 * 
 * @param {Buffer} buffer - File buffer to upload
 * @param {string} key - S3 key (path)
 * @param {string} contentType - MIME type
 * @param {Object} [metadata] - Optional metadata
 * @returns {Promise<{key: string, size: number, publicUrl: string|null}>}
 */
async function uploadBuffer(buffer, key, contentType, metadata = {}) {
    const client = getS3Client();

    if (buffer.length > MULTIPART_THRESHOLD) {
        // Use @aws-sdk/lib-storage for multipart upload
        try {
            const { Upload } = require('@aws-sdk/lib-storage');
            const upload = new Upload({
                client,
                params: {
                    Bucket: R2_BUCKET_NAME,
                    Key: key,
                    Body: buffer,
                    ContentType: contentType,
                    Metadata: metadata
                },
                queueSize: 4,          // Concurrent parts
                partSize: 5 * 1024 * 1024, // 5MB per part
                leavePartsOnError: false
            });

            upload.on('httpUploadProgress', (progress) => {
                const pct = progress.loaded && progress.total
                    ? Math.round((progress.loaded / progress.total) * 100)
                    : '?';
                console.log(`[R2 Multipart] ${key}: ${pct}% (${progress.loaded}/${progress.total})`);
            });

            await upload.done();
        } catch (e) {
            // Fallback: if @aws-sdk/lib-storage is not available, use single PUT
            if (e.code === 'MODULE_NOT_FOUND') {
                console.warn('[R2] @aws-sdk/lib-storage not found, using single PutObject for large file');
                const command = new PutObjectCommand({
                    Bucket: R2_BUCKET_NAME,
                    Key: key,
                    Body: buffer,
                    ContentType: contentType,
                    Metadata: metadata
                });
                await client.send(command);
            } else {
                throw e;
            }
        }
    } else {
        // Small file: simple PutObject
        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            Metadata: metadata
        });
        await client.send(command);
    }

    return {
        key,
        size: buffer.length,
        publicUrl: getPublicUrl(key)
    };
}

/**
 * Download an object from R2 as a Buffer.
 * @param {string} key - S3 key
 * @returns {Promise<{buffer: Buffer, contentType: string}>}
 */
async function downloadBuffer(key) {
    const client = getS3Client();
    const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key
    });

    const response = await client.send(command);
    const chunks = [];
    for await (const chunk of response.Body) {
        chunks.push(chunk);
    }

    return {
        buffer: Buffer.concat(chunks),
        contentType: response.ContentType || 'application/octet-stream'
    };
}

/**
 * List objects in a prefix.
 * @param {string} prefix - Key prefix to list
 * @param {number} [maxKeys=100] - Max results
 * @returns {Promise<Array<{key: string, size: number, lastModified: Date}>>}
 */
async function listObjects(prefix, maxKeys = 100) {
    const client = getS3Client();
    const command = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: prefix,
        MaxKeys: maxKeys
    });
    const response = await client.send(command);
    return (response.Contents || []).map((item) => ({
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified
    }));
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
    uploadBuffer,
    downloadBuffer,
    listObjects,
    getPublicUrl,
    sanitizeFilename,
    R2_BUCKET_NAME,
    MULTIPART_THRESHOLD
};
