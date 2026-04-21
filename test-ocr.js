// Teste rápido do OCR com tesseract.js (requer uma imagem real para OCR completo)
const { createWorker } = require('tesseract.js');

(async () => {
    try {
        console.log('Iniciando worker Tesseract (idioma: por)...');
        const worker = await createWorker('por');
        console.log('Worker iniciado. OCR pronto para receber imagens.');
        await worker.terminate();
        console.log('Tesseract.js carregado e funcionando corretamente.');
    } catch (err) {
        console.error('OCR falhou:', err.message);
        process.exit(1);
    }
})();
