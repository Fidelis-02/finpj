// Script manual para validar extração e análise local de documentos
// Uso: node test-ia-extraction.js

const { analisarComGroq } = require('./src/services/aiService');

const DRE_EXEMPLO = `
DEMONSTRAÇÃO DOS RESULTADOS DO EXERCÍCIO

Receitas Operacionais                                        1.250.000,00
(-) Impostos sobre Vendas                                     (112.500,00)
Receita Líquida                                               1.137.500,00
(-) Custo dos Serviços Prestados                              (568.750,00)
Lucro Bruto                                                     568.750,00
(-) Despesas Operacionais                                       (227.500,00)
  Despesas Administrativas                                      (125.000,00)
  Despesas Comerciais                                           (102.500,00)
Resultado Antes das Despesas Financeiras                        341.250,00
(-) Despesas Financeiras                                        (45.500,00)
Resultado Líquido do Exercício                                  295.750,00
`;

const BALANCO_EXEMPLO = `
BALANÇO PATRIMONIAL

ATIVO
Ativo Circulante                                                850.000,00
  Caixa e Equivalentes                                          125.000,00
  Contas a Receber                                              420.000,00
  Estoques                                                      305.000,00
Ativo Não Circulante                                            650.000,00
  Imobilizado                                                   580.000,00
  Intangível                                                     70.000,00
TOTAL DO ATIVO                                                1.500.000,00

PASSIVO
Passivo Circulante                                              525.000,00
  Fornecedores                                                  280.000,00
  Empréstimos Bancários                                         245.000,00
Passivo Não Circulante                                          225.000,00
TOTAL DO PASSIVO                                                750.000,00

PATRIMÔNIO LÍQUIDO                                              750.000,00
Capital Social                                                  500.000,00
Reservas de Lucro                                               250.000,00
TOTAL DO PASSIVO + PL                                         1.500.000,00
`;

const EXTRATO_EXEMPLO = `
Extrato Bancário - Banco do Brasil
Agência 1234 Conta 56789-0

Data        Histórico                              Valor
01/01/2024  SALDO ANTERIOR                             45.230,00
02/01/2024  PIX Recebido Cliente A                      5.000,00
03/01/2024  Pagamento Fornecedor X                     (3.500,00)
05/01/2024  TED Recebido Cliente B                     12.000,00
07/01/2024  DARF PIS/COFINS                           (1.250,00)
10/01/2024  Pagamento Aluguel                        (4.800,00)
12/01/2024  Recebimento Cartão                          8.500,00
15/01/2024  TED Enviada                                   (15.000,00)
20/01/2024  Recebimento Boleto                          6.200,00
25/01/2024  Pagamento Fornecedor Y                     (5.300,00)
31/01/2024  SALDO FINAL                                  47.080,00
`;

async function validar(tipo, texto, expectativas) {
    console.log(`\n=== Teste: ${tipo.toUpperCase()} ===`);
    const resultado = await analisarComGroq(tipo, texto, '');
    console.log('Fonte:', resultado.fonte);
    console.log('Confiança:', JSON.stringify(resultado.confianca));
    console.log('Dados:', JSON.stringify(resultado.dados, null, 2));

    let ok = true;
    for (const [chave, esperado] of Object.entries(expectativas)) {
        const obtido = resultado.dados?.[chave];
        const passou = obtido !== undefined && Math.abs(Number(obtido) - esperado) < esperado * 0.05;
        const status = passou ? '✅' : '❌';
        console.log(`${status} ${chave}: esperado ~${esperado}, obtido ${obtido}`);
        if (!passou) ok = false;
    }
    return ok;
}

(async () => {
    try {
        const resultados = [];

        resultados.push(await validar('dre', DRE_EXEMPLO, {
            receita_bruta: 1250000,
            receita_liquida: 1137500,
            custos: 568750,
            lucro_bruto: 568750,
            despesas_operacionais: 227500,
            lucro_liquido: 295750
        }));

        resultados.push(await validar('balanco', BALANCO_EXEMPLO, {
            ativo_total: 1500000,
            ativo_circulante: 850000,
            passivo_circulante: 525000,
            patrimonio_liquido: 750000
        }));

        resultados.push(await validar('extrato', EXTRATO_EXEMPLO, {
            saldo_inicial: 45230,
            total_entradas: 31700,
            total_saidas: 29850,
            saldo_final: 47080,
            num_transacoes: 9
        }));

        const todosOk = resultados.every(r => r);
        console.log(`\n=== RESULTADO FINAL: ${todosOk ? 'TODOS PASSARAM ✅' : 'ALGUNS FALHARAM ❌'} ===`);
        process.exit(todosOk ? 0 : 1);
    } catch (err) {
        console.error('Erro no teste:', err);
        process.exit(1);
    }
})();
