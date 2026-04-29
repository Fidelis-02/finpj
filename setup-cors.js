require('dotenv').config();
const { S3Client, PutBucketCorsCommand } = require('@aws-sdk/client-s3');

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

const command = new PutBucketCorsCommand({
  Bucket: process.env.R2_BUCKET_NAME || 'finpj',
  CORSConfiguration: {
    CORSRules: [
      {
        AllowedHeaders: ['*'],
        AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
        AllowedOrigins: ['*'],
        ExposeHeaders: ['ETag']
      }
    ]
  }
});

client.send(command)
  .then(() => console.log('CORS configurado com sucesso no R2!'))
  .catch(err => console.error('Erro ao configurar CORS:', err));
