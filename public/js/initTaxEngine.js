/**
 * Script de inicialização do Motor Fiscal FinPJ
 * Garante que todos os módulos estejam carregados antes de usar
 */
(function() {
    'use strict';

    const requiredModules = [
        'FinPJTaxTables',
        'FinPJTaxUtils',
        'FinPJRbt12FatorR',
        'FinPJNcmMonofasico',
        'FinPJTaxRegimes',
        'FinPJTax',
        'SimuladorEnquadramento'
    ];

    function checkModules() {
        const missing = requiredModules.filter(name => !window[name]);
        return {
            allLoaded: missing.length === 0,
            missing: missing,
            loaded: requiredModules.filter(name => window[name])
        };
    }

    function init() {
        const status = checkModules();
        
        if (status.allLoaded) {
            console.log('✅ Motor Fiscal FinPJ carregado com sucesso!');
            console.log('📦 Módulos disponíveis:', status.loaded.join(', '));
            
            // Disparar evento de ready
            window.dispatchEvent(new CustomEvent('FinPJTaxReady', {
                detail: { modules: status.loaded }
            }));
            
            return true;
        } else {
            console.warn('⏳ Aguardando módulos:', status.missing.join(', '));
            return false;
        }
    }

    // Tentar inicializar imediatamente
    if (!init()) {
        // Se falhou, aguardar DOMContentLoaded
        let attempts = 0;
        const maxAttempts = 50; // 5 segundos (100ms * 50)
        
        const interval = setInterval(function() {
            attempts++;
            
            if (init()) {
                clearInterval(interval);
            } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                console.error('❌ Falha ao carregar Motor Fiscal após 5 segundos');
                console.error('Módulos faltando:', checkModules().missing);
            }
        }, 100);
    }

    // Expor função de verificação global
    window.FinPJTaxCheck = checkModules;
})();
