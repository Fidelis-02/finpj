/**
 * Simulador de Enquadramento Tributário - FinPJ
 * Componente de UI para comparar Simples Nacional, Lucro Presumido e Lucro Real
 * Destaca em verde a opção mais barata para o cliente
 */

class SimuladorEnquadramento {
    constructor(containerSelector, options = {}) {
        this.container = document.querySelector(containerSelector);
        this.options = {
            onSimulate: null,
            onRegimeSelect: null,
            apiEndpoint: '/api/diagnostico',
            ...options
        };
        this.dadosSimulacao = null;
        
        if (this.container) {
            this.render();
            this.attachEvents();
        }
    }

    /**
     * Renderiza a estrutura HTML do simulador
     */
    render() {
        this.container.innerHTML = `
            <div class="simulador-enquadramento">
                <style>
                    .simulador-enquadramento {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        max-width: 1200px;
                        margin: 0 auto;
                        padding: 24px;
                    }
                    
                    .simulador-header {
                        text-align: center;
                        margin-bottom: 32px;
                    }
                    
                    .simulador-header h2 {
                        font-size: 1.75rem;
                        font-weight: 700;
                        color: var(--text-primary, #1a1a1a);
                        margin-bottom: 8px;
                    }
                    
                    .simulador-header p {
                        color: var(--text-secondary, #666);
                        font-size: 0.95rem;
                    }
                    
                    /* Formulário de entrada */
                    .simulador-form {
                        background: var(--card-bg, #fff);
                        border-radius: 16px;
                        padding: 24px;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                        margin-bottom: 32px;
                    }
                    
                    .form-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 16px;
                        margin-bottom: 20px;
                    }
                    
                    .form-group {
                        display: flex;
                        flex-direction: column;
                    }
                    
                    .form-group label {
                        font-size: 0.875rem;
                        font-weight: 600;
                        color: var(--text-primary, #1a1a1a);
                        margin-bottom: 6px;
                    }
                    
                    .form-group input,
                    .form-group select {
                        padding: 12px 16px;
                        border: 1px solid var(--border-color, #e5e5e5);
                        border-radius: 10px;
                        font-size: 0.95rem;
                        transition: all 0.2s;
                        background: var(--input-bg, #fff);
                    }
                    
                    .form-group input:focus,
                    .form-group select:focus {
                        outline: none;
                        border-color: var(--primary, #007AFF);
                        box-shadow: 0 0 0 3px rgba(0,122,255,0.1);
                    }
                    
                    .btn-simular {
                        background: linear-gradient(135deg, #007AFF 0%, #0056b3 100%);
                        color: white;
                        border: none;
                        padding: 14px 32px;
                        border-radius: 10px;
                        font-size: 1rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                    }
                    
                    .btn-simular:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 4px 12px rgba(0,122,255,0.3);
                    }
                    
                    .btn-simular:active {
                        transform: translateY(0);
                    }
                    
                    .btn-simular:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                        transform: none;
                    }
                    
                    /* Cards de resultado */
                    .cards-container {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                        gap: 20px;
                        margin-top: 24px;
                    }
                    
                    .regime-card {
                        background: var(--card-bg, #fff);
                        border-radius: 16px;
                        padding: 24px;
                        border: 2px solid var(--border-color, #e5e5e5);
                        transition: all 0.3s;
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .regime-card:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 8px 24px rgba(0,0,0,0.08);
                    }
                    
                    /* Card melhor opção (verde) */
                    .regime-card.is-best {
                        border-color: #34C759;
                        background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
                        box-shadow: 0 4px 20px rgba(52,199,89,0.15);
                    }
                    
                    .regime-card.is-best::before {
                        content: '✓ MELHOR OPÇÃO';
                        position: absolute;
                        top: 12px;
                        right: 12px;
                        background: #34C759;
                        color: white;
                        padding: 4px 12px;
                        border-radius: 20px;
                        font-size: 0.7rem;
                        font-weight: 700;
                        letter-spacing: 0.5px;
                    }
                    
                    /* Card mais caro (cuidado) */
                    .regime-card.is-worst {
                        border-color: #FF3B30;
                        opacity: 0.9;
                    }
                    
                    .regime-card.is-worst::before {
                        content: 'MAIS CARO';
                        position: absolute;
                        top: 12px;
                        right: 12px;
                        background: #FF3B30;
                        color: white;
                        padding: 4px 12px;
                        border-radius: 20px;
                        font-size: 0.7rem;
                        font-weight: 700;
                        letter-spacing: 0.5px;
                    }
                    
                    /* Card ineligível */
                    .regime-card.not-eligible {
                        border-color: #8E8E93;
                        background: var(--card-bg, #fff);
                        opacity: 0.7;
                    }
                    
                    .regime-card.not-eligible .card-title,
                    .regime-card.not-eligible .card-amount {
                        color: #8E8E93;
                    }
                    
                    .regime-card.not-eligible::before {
                        content: 'NÃO ELEGÍVEL';
                        position: absolute;
                        top: 12px;
                        right: 12px;
                        background: #8E8E93;
                        color: white;
                        padding: 4px 12px;
                        border-radius: 20px;
                        font-size: 0.7rem;
                        font-weight: 700;
                        letter-spacing: 0.5px;
                    }
                    
                    .card-header {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        margin-bottom: 16px;
                    }
                    
                    .card-icon {
                        width: 48px;
                        height: 48px;
                        border-radius: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 1.5rem;
                    }
                    
                    .regime-card.is-best .card-icon {
                        background: #34C75920;
                    }
                    
                    .card-title {
                        font-size: 1.1rem;
                        font-weight: 700;
                        color: var(--text-primary, #1a1a1a);
                    }
                    
                    .card-subtitle {
                        font-size: 0.8rem;
                        color: var(--text-secondary, #666);
                        margin-top: 2px;
                    }
                    
                    .card-amount {
                        font-size: 2rem;
                        font-weight: 800;
                        color: var(--text-primary, #1a1a1a);
                        margin: 16px 0;
                    }
                    
                    .regime-card.is-best .card-amount {
                        color: #1a5f2a;
                    }
                    
                    .card-rate {
                        font-size: 0.875rem;
                        color: var(--text-secondary, #666);
                        margin-bottom: 16px;
                    }
                    
                    .card-details {
                        border-top: 1px solid var(--border-color, #e5e5e5);
                        padding-top: 16px;
                        margin-top: 16px;
                    }
                    
                    .detail-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 6px 0;
                        font-size: 0.875rem;
                    }
                    
                    .detail-label {
                        color: var(--text-secondary, #666);
                    }
                    
                    .detail-value {
                        font-weight: 600;
                        color: var(--text-primary, #1a1a1a);
                    }
                    
                    .savings-highlight {
                        background: #34C759;
                        color: white;
                        padding: 12px 16px;
                        border-radius: 10px;
                        margin-top: 16px;
                        text-align: center;
                    }
                    
                    .savings-amount {
                        font-size: 1.25rem;
                        font-weight: 700;
                    }
                    
                    .savings-label {
                        font-size: 0.8rem;
                        opacity: 0.9;
                    }
                    
                    /* Loading e estados */
                    .simulador-loading {
                        display: none;
                        text-align: center;
                        padding: 48px;
                    }
                    
                    .simulador-loading.active {
                        display: block;
                    }
                    
                    .spinner {
                        width: 48px;
                        height: 48px;
                        border: 3px solid var(--border-color, #e5e5e5);
                        border-top-color: var(--primary, #007AFF);
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 16px;
                    }
                    
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                    
                    /* Resultado vazio */
                    .resultado-vazio {
                        text-align: center;
                        padding: 48px 24px;
                        color: var(--text-secondary, #666);
                    }
                    
                    .resultado-vazio-icon {
                        font-size: 3rem;
                        margin-bottom: 16px;
                    }
                    
                    /* Resumo executivo */
                    .resumo-executivo {
                        background: linear-gradient(135deg, #1a1a1a 0%, #333 100%);
                        color: white;
                        border-radius: 16px;
                        padding: 24px;
                        margin-bottom: 24px;
                    }
                    
                    .resumo-executivo h3 {
                        font-size: 1.1rem;
                        margin-bottom: 16px;
                        opacity: 0.9;
                    }
                    
                    .resumo-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                        gap: 16px;
                    }
                    
                    .resumo-item {
                        text-align: center;
                    }
                    
                    .resumo-value {
                        font-size: 1.5rem;
                        font-weight: 700;
                        color: #34C759;
                    }
                    
                    .resumo-label {
                        font-size: 0.8rem;
                        opacity: 0.7;
                        margin-top: 4px;
                    }
                    
                    /* Responsividade */
                    @media (max-width: 768px) {
                        .cards-container {
                            grid-template-columns: 1fr;
                        }
                        
                        .form-grid {
                            grid-template-columns: 1fr;
                        }
                        
                        .card-amount {
                            font-size: 1.5rem;
                        }
                    }
                    
                    /* Dark mode support */
                    @media (prefers-color-scheme: dark) {
                        .simulador-enquadramento {
                            --card-bg: #1c1c1e;
                            --text-primary: #fff;
                            --text-secondary: #8e8e93;
                            --border-color: #38383a;
                            --input-bg: #2c2c2e;
                        }
                    }
                </style>

                <div class="simulador-header">
                    <h2>🧮 Simulador de Enquadramento Tributário</h2>
                    <p>Compare Simples Nacional, Lucro Presumido e Lucro Real para encontrar o regime mais econômico</p>
                </div>

                <div class="simulador-form">
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="sim-faturamento">Faturamento Anual (R$)</label>
                            <input type="text" id="sim-faturamento" placeholder="Ex: 360000,00" inputmode="numeric">
                        </div>
                        <div class="form-group">
                            <label for="sim-margem">Margem de Lucro (%)</label>
                            <input type="number" id="sim-margem" placeholder="Ex: 15" min="0" max="100" step="0.1">
                        </div>
                        <div class="form-group">
                            <label for="sim-atividade">Atividade</label>
                            <select id="sim-atividade">
                                <option value="comercio">Comércio</option>
                                <option value="servicos">Serviços</option>
                                <option value="industria">Indústria</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="sim-ncm">NCM Principal (opcional)</label>
                            <input type="text" id="sim-ncm" placeholder="Ex: 2203.00.00" maxlength="12">
                        </div>
                    </div>
                    <button class="btn-simular" id="btn-simular">
                        <span>🚀 Simular Tributação</span>
                    </button>
                </div>

                <div class="simulador-loading" id="simulador-loading">
                    <div class="spinner"></div>
                    <p>Calculando os melhores regimes tributários...</p>
                </div>

                <div id="simulador-resultado">
                    <div class="resultado-vazio">
                        <div class="resultado-vazio-icon">📊</div>
                        <p>Preencha os dados acima e clique em "Simular Tributação" para ver a comparação</p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Anexa eventos aos elementos
     */
    attachEvents() {
        const btnSimular = this.container.querySelector('#btn-simular');
        const inputFaturamento = this.container.querySelector('#sim-faturamento');
        
        // Máscara para faturamento
        if (inputFaturamento) {
            inputFaturamento.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value) {
                    value = (parseInt(value) / 100).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                    });
                    e.target.value = value.replace('R$', '').trim();
                }
            });
        }

        btnSimular?.addEventListener('click', () => this.executarSimulacao());
    }

    /**
     * Coleta dados do formulário
     */
    coletarDados() {
        const faturamentoInput = this.container.querySelector('#sim-faturamento');
        const margemInput = this.container.querySelector('#sim-margem');
        const atividadeInput = this.container.querySelector('#sim-atividade');
        const ncmInput = this.container.querySelector('#sim-ncm');

        // Parse faturamento
        const faturamentoStr = faturamentoInput?.value || '0';
        const faturamento = parseFloat(
            faturamentoStr.replace(/[^\d,]/g, '').replace(',', '.')
        ) || 0;

        const margem = parseFloat(margemInput?.value || '0') / 100;

        return {
            nome: 'Simulação FinPJ',
            cnpj: '00000000000000',
            setor: atividadeInput?.value || 'comercio',
            regime: 'Simples Nacional',
            faturamento: faturamento,
            margem: margem,
            ncm: ncmInput?.value || ''
        };
    }

    /**
     * Executa a simulação chamando a API
     */
    async executarSimulacao() {
        const dados = this.coletarDados();
        
        if (dados.faturamento <= 0) {
            alert('Por favor, informe o faturamento anual.');
            return;
        }

        // Mostrar loading
        const loading = this.container.querySelector('#simulador-loading');
        const resultado = this.container.querySelector('#simulador-resultado');
        
        loading?.classList.add('active');
        resultado.style.display = 'none';

        try {
            let simulacao;
            
            // Tentar usar a API local primeiro
            if (typeof FinPJTax !== 'undefined') {
                // Usar motor fiscal local (client-side)
                simulacao = FinPJTax.simulateTaxes({
                    annualRevenue: dados.faturamento,
                    margin: dados.margem,
                    activity: dados.setor
                });
            } else {
                // Fallback para API
                const response = await fetch(this.options.apiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dados)
                });
                
                if (!response.ok) throw new Error('Erro na simulação');
                const data = await response.json();
                simulacao = data.resultados;
            }

            this.dadosSimulacao = simulacao;
            this.renderizarResultados(simulacao, dados);

        } catch (error) {
            console.error('Erro na simulação:', error);
            resultado.innerHTML = `
                <div class="resultado-vazio">
                    <div class="resultado-vazio-icon">⚠️</div>
                    <p>Erro ao calcular simulação. Verifique os dados e tente novamente.</p>
                    <small>${error.message}</small>
                </div>
            `;
        } finally {
            loading?.classList.remove('active');
            resultado.style.display = 'block';
        }
    }

    /**
     * Renderiza os cards de resultado
     */
    renderizarResultados(simulacao, dadosInput) {
        const resultado = this.container.querySelector('#simulador-resultado');
        
        // Determinar regimes ordenados por custo
        const regimes = simulacao.regimes || [
            { key: 'simples', name: 'Simples Nacional', annualTax: simulacao.impostos?.simples || 0, eligible: dadosInput.faturamento <= 4800000 },
            { key: 'presumido', name: 'Lucro Presumido', annualTax: simulacao.impostos?.presumido || 0, eligible: dadosInput.faturamento <= 78000000 },
            { key: 'real', name: 'Lucro Real', annualTax: simulacao.impostos?.real || 0, eligible: true }
        ];

        const regimesOrdenados = [...regimes].sort((a, b) => {
            if (!a.eligible) return 1;
            if (!b.eligible) return -1;
            return (a.annualTax || Infinity) - (b.annualTax || Infinity);
        });

        const melhorRegime = regimesOrdenados[0];
        const piorRegime = regimesOrdenados.filter(r => r.eligible).pop();
        
        const economia = (piorRegime?.annualTax || 0) - (melhorRegime?.annualTax || 0);

        // Icones para cada regime
        const icones = {
            simples: '🏪',
            presumido: '📈',
            real: '📊'
        };

        // Gerar HTML dos cards
        const cardsHTML = regimesOrdenados.map(regime => {
            const isBest = regime.key === melhorRegime?.key && regime.eligible;
            const isWorst = regime.key === piorRegime?.key && regime.eligible && regimes.filter(r => r.eligible).length > 1;
            const isEligible = regime.eligible !== false;
            
            const valorAnual = regime.annualTax || 0;
            const valorMensal = valorAnual / 12;
            const aliquotaEfetiva = dadosInput.faturamento > 0 
                ? ((valorAnual / dadosInput.faturamento) * 100).toFixed(2)
                : '0.00';
            
            const diferenca = isEligible && piorRegime 
                ? (piorRegime.annualTax || 0) - valorAnual 
                : 0;

            return `
                <div class="regime-card ${isBest ? 'is-best' : ''} ${isWorst ? 'is-worst' : ''} ${!isEligible ? 'not-eligible' : ''}" 
                     data-regime="${regime.key}">
                    <div class="card-header">
                        <div class="card-icon">${icones[regime.key] || '📋'}</div>
                        <div>
                            <div class="card-title">${regime.name}</div>
                            <div class="card-subtitle">${this.getRegimeDescricao(regime.key)}</div>
                        </div>
                    </div>
                    
                    <div class="card-amount">
                        ${valorAnual > 0 
                            ? valorAnual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
                            : 'N/A'}
                    </div>
                    
                    <div class="card-rate">
                        Alíquota efetiva: ${aliquotaEfetiva}% | 
                        Mensal: ${valorMensal > 0 
                            ? valorMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
                            : 'N/A'}
                    </div>
                    
                    ${isBest && diferenca > 0 ? `
                        <div class="savings-highlight">
                            <div class="savings-amount">
                                ${diferenca.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                            </div>
                            <div class="savings-label">economia anual vs. ${piorRegime.name}</div>
                        </div>
                    ` : ''}
                    
                    <div class="card-details">
                        <div class="detail-row">
                            <span class="detail-label">Elegibilidade:</span>
                            <span class="detail-value">${isEligible ? '✓ Elegível' : '✗ Não elegível'}</span>
                        </div>
                        ${regime.reason ? `
                            <div class="detail-row">
                                <span class="detail-label">Observação:</span>
                                <span class="detail-value">${regime.reason}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        resultado.innerHTML = `
            ${economia > 0 ? `
                <div class="resumo-executivo">
                    <h3>🎯 Resumo da Simulação</h3>
                    <div class="resumo-grid">
                        <div class="resumo-item">
                            <div class="resumo-value">
                                ${melhorRegime.name}
                            </div>
                            <div class="resumo-label">Regime Ideal</div>
                        </div>
                        <div class="resumo-item">
                            <div class="resumo-value">
                                ${economia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                            </div>
                            <div class="resumo-label">Economia Anual</div>
                        </div>
                        <div class="resumo-item">
                            <div class="resumo-value">
                                ${(economia / 12).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                            </div>
                            <div class="resumo-label">Economia Mensal</div>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <div class="cards-container">
                ${cardsHTML}
            </div>
        `;

        // Adicionar eventos de clique nos cards
        resultado.querySelectorAll('.regime-card').forEach(card => {
            card.addEventListener('click', () => {
                const regimeKey = card.dataset.regime;
                if (this.options.onRegimeSelect) {
                    this.options.onRegimeSelect(regimeKey, this.dadosSimulacao);
                }
            });
        });
    }

    /**
     * Retorna descrição do regime
     */
    getRegimeDescricao(key) {
        const descricoes = {
            simples: 'Tributação unificada (DAS)',
            presumido: 'Presunção de lucro fixa',
            real: 'Lucro real apurado'
        };
        return descricoes[key] || '';
    }
}

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimuladorEnquadramento;
} else {
    window.SimuladorEnquadramento = SimuladorEnquadramento;
}
