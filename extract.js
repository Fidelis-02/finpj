const fs = require('fs');

try {
    const html = fs.readFileSync('index.html', 'utf8');

    const styleRegex = /<style>([\s\S]*?)<\/style>/;
    // Pega o ULTIMO bloco <script> que contém o código da aplicação (não os CDNs)
    // Para ser mais seguro, vamos pegar o que tem "document.addEventListener('DOMContentLoaded'"
    const scriptRegex = /<script>\s*([\s\S]*?document\.addEventListener\('DOMContentLoaded'[\s\S]*?)<\/script>/;

    const styleMatch = html.match(styleRegex);
    let newHtml = html;

    if (styleMatch) {
        fs.writeFileSync('style.css', styleMatch[1]);
        newHtml = newHtml.replace(styleRegex, '<link rel="stylesheet" href="style.css">');
        console.log('CSS extraído com sucesso.');
    } else {
        console.log('Nenhum bloco <style> encontrado.');
    }
    
    const scriptMatch = newHtml.match(scriptRegex);
    if (scriptMatch) {
        fs.writeFileSync('app.js', scriptMatch[1]);
        newHtml = newHtml.replace(scriptRegex, '<script src="app.js"></script>');
        console.log('JS extraído com sucesso.');
    } else {
        console.log('Nenhum bloco <script> principal encontrado.');
    }
    
    fs.writeFileSync('index.html', newHtml);
    console.log('index.html atualizado.');
} catch (e) {
    console.error('Erro:', e);
}
