const simplesNacional = require('../tax/regimes/simplesNacional');

function gerarNotasMocks(cnpj) {
    const hoje = new Date();
    const notas = [];
    const qtdNotas = Math.floor(Math.random() * 8) + 3; // 3 a 10 notas
    
    let faturamentoTotal = 0;
    
    for (let i = 0; i < qtdNotas; i++) {
        const dataEmissao = new Date(hoje);
        dataEmissao.setDate(hoje.getDate() - Math.floor(Math.random() * 28)); // Últimos 28 dias
        const valor = Math.round((Math.random() * 5000 + 1000) * 100) / 100;
        faturamentoTotal += valor;
        
        notas.push({
            chave: '352' + Math.floor(Math.random() * 90000000000000) + cnpj + '550010000' + Math.floor(Math.random() * 99999),
            numero: Math.floor(Math.random() * 5000) + 100,
            data_emissao: dataEmissao.toISOString().slice(0, 10),
            valor: valor,
            status: 'AUTORIZADA',
            tipo: Math.random() > 0.5 ? 'NF-e' : 'NFS-e',
            tomador: {
                nome: 'Cliente ' + String.fromCharCode(65 + i) + ' LTDA',
                cnpj: '00.000.000/0001-' + String(i).padStart(2, '0')
            }
        });
    }
    
    // Ordena da mais recente para a mais antiga
    notas.sort((a, b) => new Date(b.data_emissao) - new Date(a.data_emissao));
    
    return {
        notas,
        faturamentoTotal: Math.round(faturamentoTotal * 100) / 100
    };
}

async function fetchNotasFiscais(cnpj) {
    // Aqui no futuro será a chamada para FocusNFe ou Arquivei
    // Exemplo: fetch('https://api.focusnfe.com.br/v2/nfe/recebidas?cnpj=' + cnpj, { headers: { Authorization: `Basic ${process.env.FOCUS_NFE_KEY}` } })
    
    return new Promise((resolve) => {
        setTimeout(() => {
            const data = gerarNotasMocks(cnpj);
            resolve({
                sucesso: true,
                notas: data.notas,
                resumo: {
                    periodo: new Date().toISOString().slice(0, 7), // Mês atual
                    totalNotas: data.notas.length,
                    faturamento: data.faturamentoTotal
                }
            });
        }, 1500); // delay para simular a rede
    });
}

function calcularDasAutomatico(faturamentoPeriodo, anexoI = true) {
    // Cálculo simplificado do Simples Nacional
    // No mundo real, precisaríamos do faturamento dos últimos 12 meses (RBT12)
    // Aqui usamos o faturamento do mês projetado para o ano
    const rbt12 = faturamentoPeriodo * 12;
    const result = simplesNacional.calculate({
        annualRevenue: rbt12,
        margin: 0,
        activity: 'comercio',
        calendarYear: new Date().getFullYear()
    });
    if (result.eligible === false) {
        throw new Error(result.reason || 'Faturamento fora do Simples Nacional.');
    }
    
    // Tabela Anexo I (Comércio)
    const valorDas = Math.round((result.annualTax / 12) * 100) / 100;
    const hoje = new Date();
    const vencimento = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 20).toISOString().slice(0, 10);
    
    return {
        valor: valorDas,
        aliquotaEfetiva: (result.effectiveRate * 100).toFixed(2),
        vencimento: vencimento,
        competencia: hoje.toISOString().slice(0, 7),
        linhaDigitavel: '858' + Math.floor(Math.random() * 9000000000000000000).toString().padStart(40, '0') // PIX/Código de barras mockado
    };
}

module.exports = {
    fetchNotasFiscais,
    calcularDasAutomatico
};
