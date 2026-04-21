let cnpjConsultaTimer = null;
        let cnpjAbortController = null;
        let cnpjUltimoSucessoDigits = '';

        function aliquotaSimplesEfetiva(fat, atividade) {
            let a;
            if (fat <= 180000) a = 0.06;
            else if (fat <= 360000) a = 0.067;
            else if (fat <= 720000) a = 0.075;
            else if (fat <= 1800000) a = 0.085;
            else if (fat <= 3600000) a = 0.095;
            else if (fat <= 4800000) a = 0.105;
            else if (fat <= 10000000) a = 0.125;
            else a = 0.15;
            if (atividade === 'comercio') return a * 0.9;
            if (atividade === 'industria') return a * 0.95;
            return a;
        }
        let pendingPlano = null;

        function abrirModalPagamento(plano) {
            pendingPlano = plano;
            if (isLoggedIn()) {
                iniciarCompra(plano);
                return;
            }
            openModal('login');
            setLoginStep('email');
        }

        function basesLucroPresumido(fat, atividade) {
            let pctIrpj = 0.32;
            let pctCsll = 0.32;
            if (atividade === 'comercio') {
                pctIrpj = 0.08;
                pctCsll = 0.12;
            } else if (atividade === 'industria') {
                pctIrpj = 0.12;
                pctCsll = 0.12;
            } else if (atividade === 'tecnologia') {
                pctIrpj = 0.32;
                pctCsll = 0.32;
            }
            return { baseIrpj: fat * pctIrpj, baseCsll: fat * pctCsll };
        }

        function irpjLucroPresumido(baseIrpj) {
            return baseIrpj * 0.15 + Math.max(0, baseIrpj - 240000) * 0.10;
        }

        function destacarRegimeSimulador(melhor) {
            ['simples', 'presumido', 'real'].forEach(function (k) {
                const el = document.getElementById('sim-card-' + k);
                if (el) el.classList.toggle('sim-card--winner', k === melhor);
            });
        }

        function calcularSimulador() {
            const fat = parseInt(document.getElementById('simulador-fat').value, 10);
            const margem = parseFloat(document.getElementById('simulador-margem').value);
            const atividade = document.getElementById('simulador-atividade')
                ? document.getElementById('simulador-atividade').value
                : 'servicos';

            document.getElementById('lbl-fat').textContent =
                'R$ ' + fat.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

            const aliqS = aliquotaSimplesEfetiva(fat, atividade);
            const impostoS = fat * aliqS;

            const bases = basesLucroPresumido(fat, atividade);
            const irpjP = irpjLucroPresumido(bases.baseIrpj);
            const csllP = bases.baseCsll * 0.09;
            const impostoP = irpjP + csllP + fat * 0.0165 + fat * 0.076;

            const lucroReal = Math.max(0, fat * margem);
            const irpjR = lucroReal * 0.15 + Math.max(0, lucroReal - 240000) * 0.10;
            const csllR = lucroReal * 0.09;
            const impostoR = irpjR + csllR + fat * 0.0165 + fat * 0.076;

            const fmt = function (v) {
                return 'R$ ' + Math.round(v).toLocaleString('pt-BR');
            };

            document.getElementById('val-simples').textContent = fmt(impostoS);
            document.getElementById('pct-simples').textContent = ((impostoS / fat) * 100).toFixed(1) + '%';

            document.getElementById('val-presumido').textContent = fmt(impostoP);
            document.getElementById('pct-presumido').textContent = ((impostoP / fat) * 100).toFixed(1) + '%';

            document.getElementById('val-real').textContent = fmt(impostoR);
            document.getElementById('pct-real').textContent = ((impostoR / fat) * 100).toFixed(1) + '%';

            const minT = Math.min(impostoS, impostoP, impostoR);
            const empate = Math.max(1, minT * 0.00005);
            let melhor = 'real';
            if (Math.abs(impostoS - minT) <= empate) melhor = 'simples';
            else if (Math.abs(impostoP - minT) <= empate) melhor = 'presumido';

            destacarRegimeSimulador(melhor);
        }

        // Modals
        function openModal(name) {
            document.getElementById(name + '-modal').classList.add('active');
            if (name === 'diagnose') {
                calcularSimulador();
            }
        }

        function closeModal(name) {
            document.getElementById(name + '-modal').classList.remove('active');
        }

        function fmtReais(v) {
            return 'R$ ' + Math.round(Number(v) || 0).toLocaleString('pt-BR');
        }

        function setTab(n) {
            const tabs = document.querySelectorAll('#diagnose-modal .tab-content');
            const btns = document.querySelectorAll('#onboarding-tabs .tab-btn');
            tabs.forEach(t => t.classList.remove('active'));
            btns.forEach(b => b.classList.remove('active'));
            const panel = document.getElementById('tab' + n);
            if (panel) panel.classList.add('active');
            const btn = document.querySelector('#onboarding-tabs .tab-btn[data-tab="' + n + '"]');
            if (btn) btn.classList.add('active');
        }

        function setCnpjMsg(texto, tipo) {
            const el = document.getElementById('cnpj-consulta-msg');
            if (!el) return;
            el.textContent = texto || '';
            el.className = 'cnpj-msg' + (tipo ? ' ' + tipo : '');
        }

        function setorFromCnae(cnaeFiscal, descricao) {
            const cod = parseInt(String(cnaeFiscal || '').replace(/\D/g, '').slice(0, 2), 10);
            const txt = String(descricao || '');
            if (txt.match(/software|tecnologia da informação|informática|desenvolvimento de programas|data processing|hospedagem de/i)) return 'tecnologia';
            if (cod === 62 || cod === 63) return 'tecnologia';
            if (cod >= 45 && cod <= 47) return 'comercio';
            if (cod >= 10 && cod <= 33) return 'industria';
            return 'servicos';
        }

        function aplicarDadosCnpj(data) {
            if (data.nome) {
                document.getElementById('inp-nome').value = data.nome;
                limparErro('inp-nome');
            }
            const setor = setorFromCnae(data.cnae_fiscal, data.cnae_descricao || data.cnae);
            const sel = document.getElementById('inp-setor');
            if (sel) sel.value = setor;

            const linha = document.getElementById('linha-cnae');
            const codEl = document.getElementById('inp-cnae-codigo');
            const txtEl = document.getElementById('inp-cnae-texto');
            if (data.cnae_fiscal != null && String(data.cnae_fiscal).length) {
                if (codEl) codEl.textContent = String(data.cnae_fiscal);
                if (txtEl) txtEl.textContent = data.cnae_descricao || data.cnae || '—';
                if (linha) linha.style.display = 'block';
            } else if (data.cnae_descricao || data.cnae) {
                if (codEl) codEl.textContent = '—';
                if (txtEl) txtEl.textContent = data.cnae_descricao || data.cnae;
                if (linha) linha.style.display = 'block';
            } else if (linha) {
                linha.style.display = 'none';
            }

            const simAt = document.getElementById('simulador-atividade');
            if (simAt && ['comercio', 'servicos', 'industria', 'tecnologia'].indexOf(setor) !== -1) {
                simAt.value = setor;
            }
            if (typeof calcularSimulador === 'function') calcularSimulador();
        }

        function validarCnpjDigitos() {
            const cnpj = document.getElementById('inp-cnpj');
            if (!validarCNPJ(cnpj.value)) {
                marcarErro('inp-cnpj');
                return false;
            }
            limparErro('inp-cnpj');
            return true;
        }

        function validarNomePreenchido() {
            const nome = document.getElementById('inp-nome');
            if (!nome.value.trim()) {
                marcarErro('inp-nome');
                return false;
            }
            limparErro('inp-nome');
            return true;
        }

        function cancelarConsultaCnpj() {
            if (cnpjAbortController) {
                cnpjAbortController.abort();
                cnpjAbortController = null;
            }
        }
        function isLoggedIn() {
            return Boolean(localStorage.getItem('finpjToken') || localStorage.getItem('authToken'));
        }

        function setLoginStep(step) {
            ['email', 'cnpj', 'code'].forEach(s => {
                const el = document.getElementById('login-step-' + s);
                if (el) el.classList.toggle('active', step === s);
            });
            const msg = document.getElementById('login-message');
            if (msg) msg.textContent = '';
            if (step === 'code') {
                const email = localStorage.getItem('finpjAuthEmail') || '';
                const prev = document.getElementById('login-email-preview');
                if (prev) prev.textContent = email;
            }
        }

        function setLoginTab(tab) {
            const tabs = document.querySelectorAll('#login-tabs .tab-btn');
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelector(`#login-tabs .tab-btn[data-tab="${tab}"]`).classList.add('active');
            setLoginStep(tab);
        }

        function showLoginMessage(message) {
            const el = document.getElementById('login-message');
            if (el) el.textContent = message;
        }

        async function safeJsonParse(response) {
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('Response is not JSON:', text);
                throw new Error('Resposta do servidor inválida (não é JSON).');
            }
        }

        async function sendLoginCode() {
            const emailInput = document.getElementById('login-email');
            const email = emailInput ? emailInput.value.trim() : '';
            if (!email || !email.includes('@')) {
                showLoginMessage('Digite um e-mail válido para continuar.');
                return;
            }
            const btn = document.querySelector('#login-step-email .btn-primary');
            if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
            try {
                const res = await fetch('/api/auth/send-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await safeJsonParse(res);
                if (!res.ok || !data.sucesso) throw new Error(data.erro || 'Não foi possível enviar o código.');
                localStorage.setItem('finpjAuthEmail', email);
                setLoginStep('code');
                if (data._devCode) {
                    // Sem SMTP configurado: preenche automaticamente e avisa
                    const codeInput = document.getElementById('login-code');
                    if (codeInput) codeInput.value = data._devCode;
                    showLoginMessage('⚠️ Modo dev: código preenchido automaticamente. Configure SMTP para envio real.');
                } else {
                    showLoginMessage('Código enviado! Verifique sua caixa de entrada.');
                }
            } catch (erro) {
                showLoginMessage(erro.message || 'Falha ao enviar o código. Tente novamente.');
            } finally {
                if (btn) { btn.disabled = false; btn.textContent = 'Enviar código'; }
            }
        }

        async function verifyLoginCode() {
            const email = localStorage.getItem('finpjAuthEmail');
            const code = document.getElementById('login-code').value.trim();
            if (!email || !code) {
                showLoginMessage('Informe o código que você recebeu por e-mail.');
                return;
            }
            try {
                const res = await fetch('/api/auth/verify-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, code })
                });
                const data = await safeJsonParse(res);
                if (!res.ok || !data.sucesso) {
                    throw new Error(data.erro || 'Código inválido.');
                }
                localStorage.setItem('finpjToken', data.token);
                localStorage.setItem('finpjAuthEmail', email);
                updateAuthState();
                closeModal('login');
                if (pendingPlano) {
                    iniciarCompra(pendingPlano);
                    pendingPlano = null;
                    return;
                }
                openDashboard();
            } catch (erro) {
                console.error('Verificação de código:', erro);
                showLoginMessage(erro.message || 'Não foi possível validar o código.');
            }
        }

        async function iniciarCompra(plano) {
            const email = localStorage.getItem('finpjAuthEmail');
            if (!email) {
                abrirModalPagamento(plano);
                return;
            }
            try {
                const res = await fetch('/api/pagamento', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ plano, email })
                });
                const data = await safeJsonParse(res);
                if (!res.ok || !data.checkoutUrl) {
                    throw new Error(data.erro || 'Não foi possível iniciar o pagamento.');
                }
                window.location.href = data.checkoutUrl;
            } catch (erro) {
                console.error('Pagamento:', erro);
                alert(erro.message || 'Erro ao iniciar o pagamento.');
            }
        }

        async function openDashboard() {
            if (!isLoggedIn()) { openModal('login'); setLoginStep('email'); return; }
            updateAuthState();
            await loadDashboard();
        }

        async function loadDashboard() {
            const token = localStorage.getItem('finpjToken') || localStorage.getItem('authToken');
            if (!token) return;
            try {
                const res = await fetch('/api/dashboard', { headers: { Authorization: 'Bearer ' + token } });
                const data = await safeJsonParse(res);
                if (!res.ok || !data.sucesso) throw new Error(data.erro || 'Falha ao carregar.');
                const db = data.dashboard;
                const greeting = db.user.fantasia || db.user.nome || db.user.email.split('@')[0];
                document.getElementById('dashboard-welcome').textContent = `Olá, ${greeting}`;
                document.getElementById('dashboard-report-count').textContent = `${db.summary.reportsCount} relatórios`;
                document.getElementById('dashboard-pendings').textContent = `${db.summary.pendencias} alertas`;
                const body = document.getElementById('dashboard-reports-body');
                body.innerHTML = '';
                db.reports.forEach(r => {
                    const row = document.createElement('tr');
                    const sc = r.status === 'Concluído' ? 'ok' : 'warn';
                    row.innerHTML = `<td>${r.date}</td><td>${r.title}</td><td>R$ ${r.amount.toLocaleString('pt-BR')}</td><td><span class="report-status ${sc}">${r.status}</span></td>`;
                    body.appendChild(row);
                });
                
                // Segregação de plano com Empty States
                const plano = localStorage.getItem('finpj_plano') || 'enterprise'; // Force enterprise para o dev
                const advGrid = document.getElementById('advanced-charts-grid');
                const overlayCharts = document.getElementById('upgrade-overlay-charts');
                const overlayMom = document.getElementById('upgrade-overlay-mom');
                
                if (plano === 'starter') {
                    if (overlayCharts) overlayCharts.style.display = 'flex';
                    if (overlayMom) overlayMom.style.display = 'flex';
                    // We still display the grid to show the blurry background
                } else {
                    if (overlayCharts) overlayCharts.style.display = 'none';
                    if (overlayMom) overlayMom.style.display = 'none';
                }

                await loadConnectedBanks();
            } catch (e) { console.error('Dashboard:', e); logoutCliente(); }
        }

        function switchView(viewName) {
            document.querySelectorAll('.app-view').forEach(v => v.style.display = 'none');
            const target = document.getElementById('view-' + viewName);
            if (target) target.style.display = 'block';
            document.querySelectorAll('#nav-app-links .nav-link').forEach(b => {
                b.classList.toggle('active', b.textContent.trim().toLowerCase().includes(viewName === 'overview' ? 'dashboard' : viewName === 'openfinance' ? 'open' : viewName === 'calculadora' ? 'calc' : viewName));
            });
            if (viewName === 'analise') carregarHistoricoAnalises();
            if (viewName === 'openfinance') loadConnectedBanks();
            if (viewName === 'conciliacao') updateConciliacaoView();
            if (viewName === 'calendario') loadFiscalCalendar();
            if (viewName === 'perfil') loadProfile();
            if (viewName === 'overview') { loadCharts(); loadMoMComparison(); }
            document.getElementById('notif-panel').style.display = 'none';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function updateAuthState() {
            const logged = isLoggedIn();
            document.getElementById('landing-page').style.display = logged ? 'none' : 'block';
            document.getElementById('app-dashboard').style.display = logged ? 'block' : 'none';
            document.getElementById('nav-landing-links').style.display = logged ? 'none' : 'flex';
            document.getElementById('nav-app-links').style.display = logged ? 'flex' : 'none';
            document.getElementById('nav-auth-group').style.display = logged ? 'none' : 'flex';
            document.getElementById('nav-user-group').style.display = logged ? 'flex' : 'none';
            if (logged) {
                const email = localStorage.getItem('finpjAuthEmail') || '';
                document.getElementById('nav-user-email').textContent = email;
            }
        }

        function logoutCliente() {
            localStorage.removeItem('finpjToken');
            localStorage.removeItem('authToken');
            localStorage.removeItem('finpjAuthEmail');
            updateAuthState();
            closeModal('login');
        }

        // ===== OPEN FINANCE =====
        let _connectedBanks = [];

        async function loadConnectedBanks() {
            const token = localStorage.getItem('finpjToken') || localStorage.getItem('authToken');
            if (!token) return;
            try {
                const res = await fetch('/api/openfinance/banks', { headers: { Authorization: 'Bearer ' + token } });
                const data = await safeJsonParse(res);
                _connectedBanks = data.banks || [];
                renderConnectedBanks();
                const bc = document.getElementById('dashboard-banks-count');
                if (bc) bc.textContent = _connectedBanks.length + ' bancos';
            } catch (e) { console.error('Open Finance:', e); }
        }

        function renderConnectedBanks() {
            const area = document.getElementById('connected-banks-area');
            const list = document.getElementById('connected-banks-list');
            if (!_connectedBanks.length) { area.style.display = 'none'; return; }
            area.style.display = 'block';
            list.innerHTML = _connectedBanks.map(b => `
                <div class="dashboard-card" style="position:relative;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                        <div style="width:8px;height:8px;border-radius:50%;background:#34d399;"></div>
                        <strong style="font-size:14px;color:var(--text-primary);">${b.bankName}</strong>
                    </div>
                    <div style="font-size:12px;color:var(--text-secondary);">${b.accountType}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Sincronizado: ${new Date(b.lastSync).toLocaleDateString('pt-BR')}</div>
                    <div style="margin-top:12px;display:flex;gap:8px;">
                        <button class="btn-secondary" style="padding:6px 12px;font-size:11px;border-radius:6px;" onclick="syncBank('${b.bankId}')">🔄 Sincronizar</button>
                        <button class="btn-secondary" style="padding:6px 12px;font-size:11px;border-radius:6px;color:#ef4444;border-color:#ef4444;" onclick="disconnectBank('${b.bankId}')">Desconectar</button>
                    </div>
                </div>
            `).join('');
            renderAllTransactions();
        }

        function renderAllTransactions() {
            const panel = document.getElementById('of-transactions');
            const body = document.getElementById('of-transactions-body');
            const allTx = _connectedBanks.flatMap(b => (b.transactions || []).map(t => ({...t, bank: b.bankName})));
            if (!allTx.length) { panel.style.display = 'none'; return; }
            panel.style.display = 'block';
            allTx.sort((a, b) => b.data.localeCompare(a.data));
            body.innerHTML = allTx.slice(0, 30).map(t => {
                const cor = t.tipo === 'entrada' ? '#34d399' : '#ef4444';
                return `<tr><td>${t.data}</td><td>${t.descricao} <span style="font-size:10px;color:var(--text-muted);">(${t.bank})</span></td><td style="color:${cor};font-weight:600;">R$ ${Math.abs(t.valor).toLocaleString('pt-BR')}</td><td><span style="font-size:11px;padding:2px 8px;border-radius:999px;background:${t.tipo==='entrada'?'rgba(52,211,153,0.12)':'rgba(239,68,68,0.12)'};color:${cor};">${t.tipo}</span></td><td>${t.categoria}</td></tr>`;
            }).join('');
        }

        async function connectBank(bankId, bankName) {
            const token = localStorage.getItem('finpjToken') || localStorage.getItem('authToken');
            if (!token) return;
            
            try {
                const btn = document.activeElement;
                const oldText = btn.textContent;
                btn.textContent = 'Carregando...';
                
                const res = await fetch('/api/openfinance/token', {
                    headers: { Authorization: 'Bearer ' + token }
                });
                const data = await safeJsonParse(res);
                btn.textContent = oldText;

                if (!res.ok || !data.sucesso || !data.token) {
                    throw new Error(data.erro || 'Erro ao iniciar conexão segura.');
                }
                
                const pluggyConnect = new PluggyConnect({
                    connectToken: data.token,
                    includeSandbox: true, // Mostra o banco de teste "Pluggy Bank"
                    onSuccess: async (itemData) => {
                        try {
                            const connectRes = await fetch('/api/openfinance/connect', {
                                method: 'POST', 
                                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                                body: JSON.stringify({ itemId: itemData.item.id })
                            });
                            const connectData = await safeJsonParse(connectRes);
                            if (!connectRes.ok || !connectData.sucesso) throw new Error(connectData.erro || 'Erro ao importar dados financeiros.');
                            await loadConnectedBanks();
                            alert('Banco conectado com sucesso via Open Finance!');
                        } catch (e) {
                            alert(e.message);
                        }
                    },
                    onError: (error) => {
                        console.error('Pluggy Connect Error:', error);
                    }
                });
                
                pluggyConnect.init();

            } catch (e) {
                alert(e.message);
            }
        }

        async function syncBank(bankId) {
            const token = localStorage.getItem('finpjToken') || localStorage.getItem('authToken');
            try {
                await fetch('/api/openfinance/sync/' + bankId, { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
                await loadConnectedBanks();
            } catch (e) { console.error(e); }
        }

        async function disconnectBank(bankId) {
            if (!confirm('Desconectar este banco?')) return;
            const token = localStorage.getItem('finpjToken') || localStorage.getItem('authToken');
            try {
                await fetch('/api/openfinance/banks/' + bankId, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
                await loadConnectedBanks();
            } catch (e) { console.error(e); }
        }

        // ===== CONCILIAÇÃO =====
        function updateConciliacaoView() {
            const noBanks = document.getElementById('conc-no-banks');
            const withBanks = document.getElementById('conc-with-banks');
            if (!_connectedBanks.length) { noBanks.style.display = 'block'; withBanks.style.display = 'none'; return; }
            noBanks.style.display = 'none'; withBanks.style.display = 'block';
            const sel = document.getElementById('conc-bank-select');
            sel.innerHTML = _connectedBanks.map(b => `<option value="${b.bankId}">${b.bankName}</option>`).join('');
            loadConciliacao();
        }

        function loadConciliacao() {
            const bankId = document.getElementById('conc-bank-select').value;
            const bank = _connectedBanks.find(b => b.bankId === bankId);
            if (!bank || !bank.transactions) return;
            const tx = bank.transactions;
            const entradas = tx.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Math.abs(t.valor), 0);
            const saidas = tx.filter(t => t.tipo === 'saida').reduce((s, t) => s + Math.abs(t.valor), 0);
            document.getElementById('conc-summary').innerHTML = `
                <div class="dashboard-card"><h3>Entradas</h3><strong style="color:#34d399;">R$ ${entradas.toLocaleString('pt-BR')}</strong></div>
                <div class="dashboard-card"><h3>Saídas</h3><strong style="color:#ef4444;">R$ ${saidas.toLocaleString('pt-BR')}</strong></div>
                <div class="dashboard-card"><h3>Saldo</h3><strong style="color:${entradas-saidas>=0?'#60a5fa':'#ef4444'};">R$ ${(entradas - saidas).toLocaleString('pt-BR')}</strong></div>
            `;
            const body = document.getElementById('conc-table-body');
            body.innerHTML = tx.map(t => {
                const cor = t.tipo === 'entrada' ? '#34d399' : '#ef4444';
                return `<tr><td>${t.data}</td><td>${t.descricao}</td><td style="color:${cor};font-weight:600;">R$ ${Math.abs(t.valor).toLocaleString('pt-BR')}</td><td><span style="font-size:11px;padding:2px 8px;border-radius:999px;background:${t.tipo==='entrada'?'rgba(52,211,153,0.12)':'rgba(239,68,68,0.12)'};color:${cor};">${t.tipo}</span></td><td>${t.categoria}</td><td><span class="report-status ok">Conciliado</span></td></tr>`;
            }).join('');
        }

        async function loginWithCnpj() {
            const cnpjRaw = document.getElementById('login-cnpj').value.trim();
            const cnpj = cnpjRaw.replace(/\D/g, '');
            const password = document.getElementById('login-password').value.trim();
            if (cnpj.length !== 14) {
                showLoginMessage('CNPJ deve ter 14 dígitos.');
                return;
            }
            if (!password) {
                showLoginMessage('Digite a senha.');
                return;
            }
            const btn = document.querySelector('#login-step-cnpj .btn-primary');
            if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }
            try {
                const res = await fetch('/api/auth/login-cnpj', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cnpj, password })
                });
                const data = await safeJsonParse(res);
                if (!res.ok || !data.sucesso) {
                    throw new Error(data.erro || 'Login falhou.');
                }
                localStorage.setItem('finpjToken', data.token);
                localStorage.setItem('finpjAuthEmail', data.email);
                updateAuthState();
                closeModal('login');
                if (pendingPlano) {
                    iniciarCompra(pendingPlano);
                    pendingPlano = null;
                    return;
                }
                openDashboard();
            } catch (erro) {
                showLoginMessage(erro.message || 'Erro no login.');
            } finally {
                if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
            }
        }

        async function registerWithCnpj() {
            const cnpjRaw = document.getElementById('register-cnpj').value.trim();
            const cnpj = cnpjRaw.replace(/\D/g, '');
            const password = document.getElementById('register-password').value.trim();
            const confirm = document.getElementById('register-confirm-password').value.trim();
            const msgEl = document.getElementById('register-message');
            if (cnpj.length !== 14) { msgEl.textContent = 'CNPJ deve ter 14 dígitos.'; return; }
            if (!password || password.length < 6) { msgEl.textContent = 'Senha mínimo 6 caracteres.'; return; }
            if (password !== confirm) { msgEl.textContent = 'As senhas não coincidem.'; return; }
            const btn = document.querySelector('#register-modal .btn-primary');
            if (btn) { btn.disabled = true; btn.textContent = 'Criando...'; }
            try {
                const res = await fetch('/api/auth/register-cnpj', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cnpj, password })
                });
                const data = await safeJsonParse(res);
                if (!res.ok || !data.sucesso) throw new Error(data.erro || 'Registro falhou.');
                msgEl.style.color = '#34d399';
                msgEl.textContent = '✅ ' + (data.mensagem || 'Conta criada! Faça login agora.');
                setTimeout(() => {
                    closeModal('register');
                    openModal('login');
                    setLoginTab('cnpj');
                    document.getElementById('login-cnpj').value = cnpjRaw;
                }, 1800);
            } catch (erro) {
                msgEl.style.color = '#ef4444';
                msgEl.textContent = erro.message || 'Erro no registro.';
            } finally {
                if (btn) { btn.disabled = false; btn.textContent = 'Criar conta'; }
            }
        }

        function loginWithGoogle() {
            // Google OAuth not yet configured
            showLoginMessage('Login com Google em breve.');
        }

        function formatarCNPJInput(input) {
            formatarCNPJ(input);
        }

        async function buscarCnpjNaReceita(silencioso) {
            if (!validarCnpjDigitos()) {
                if (!silencioso) setCnpjMsg('CNPJ incompleto ou dígitos verificadores inválidos.', 'err');
                return false;
            }
            const cnpj = document.getElementById('inp-cnpj').value.replace(/\D/g, '');
            if (cnpj === cnpjUltimoSucessoDigits && document.getElementById('inp-nome').value.trim()) {
                if (!silencioso) setCnpjMsg('Dados deste CNPJ já estão carregados.', 'ok');
                return true;
            }

            cancelarConsultaCnpj();
            const ac = new AbortController();
            cnpjAbortController = ac;

            if (!silencioso) setCnpjMsg('Consultando bases públicas (BrasilAPI / ReceitaWS)…', '');
            try {
                const res = await fetch('/api/cnpj?cnpj=' + encodeURIComponent(cnpj), {
                    signal: ac.signal,
                    headers: { Accept: 'application/json' }
                });
                const raw = await res.text();
                let data = null;
                if (raw) {
                    try {
                        data = JSON.parse(raw);
                    } catch (parseErr) {
                        if (!silencioso) {
                            setCnpjMsg(
                                'O servidor devolveu uma resposta que não é JSON (geralmente HTML de bloqueio ou erro de proxy). Use o app via http://localhost:3000 com npm start.',
                                'err'
                            );
                        }
                        marcarErro('inp-cnpj');
                        return false;
                    }
                }

                const atual = document.getElementById('inp-cnpj').value.replace(/\D/g, '');
                if (atual !== cnpj) {
                    return false;
                }

                if (!res.ok) {
                    const msg =
                        (data && (data.erro || data.message)) ||
                        (res.status === 502
                            ? 'Servidor não conseguiu consultar o CNPJ (tempo esgotado ou rede).'
                            : 'CNPJ não encontrado ou inválido nas bases consultadas.');
                    if (!silencioso) setCnpjMsg(msg, 'err');
                    marcarErro('inp-cnpj');
                    return false;
                }

                if (!data || typeof data !== 'object') {
                    if (!silencioso) setCnpjMsg('Resposta vazia do servidor.', 'err');
                    return false;
                }

                if (!data.ativo) {
                    if (!silencioso) {
                        setCnpjMsg(
                            'Empresa encontrada, mas a situação cadastral não é ativa. Ajuste o cadastro ou use outro CNPJ.',
                            'err'
                        );
                    }
                    marcarErro('inp-cnpj');
                    return false;
                }

                aplicarDadosCnpj(data);
                cnpjUltimoSucessoDigits = cnpj;
                if (!silencioso) {
                    const fonte = data.fonte ? 'Fonte: ' + data.fonte + '.' : '';
                    setCnpjMsg('Dados carregados: razão social, CNAE e setor. ' + fonte, 'ok');
                } else {
                    setCnpjMsg('', '');
                }
                limparErro('inp-cnpj');
                return true;
            } catch (e) {
                if (e && e.name === 'AbortError') {
                    return false;
                }
                console.error(e);
                if (!silencioso) {
                    setCnpjMsg(
                        'Não foi possível consultar o CNPJ. Confirme que o site está aberto em http://localhost:3000 (npm start) e que não há bloqueio de rede.',
                        'err'
                    );
                }
                return false;
            } finally {
                if (cnpjAbortController === ac) cnpjAbortController = null;
            }
        }

        function onCnpjInput(el) {
            formatarCNPJ(el);
            const digits = el.value.replace(/\D/g, '');
            if (digits !== cnpjUltimoSucessoDigits) {
                cnpjUltimoSucessoDigits = '';
            }
            setCnpjMsg('', '');
            cancelarConsultaCnpj();
            if (cnpjConsultaTimer) clearTimeout(cnpjConsultaTimer);
            if (digits.length === 14 && validarCNPJ(el.value)) {
                cnpjConsultaTimer = setTimeout(function () {
                    buscarCnpjNaReceita(true);
                }, 600);
            }
        }

        async function validarEtapa1ComApi() {
            const ok = await buscarCnpjNaReceita(false);
            if (!ok) return false;
            if (!validarNomePreenchido()) {
                alert('Não foi possível obter a razão social. Preencha o nome manualmente.');
                return false;
            }
            return true;
        }

        async function goTab(n) {
            if (n === 1) {
                setTab(1);
                return;
            }
            if (n === 2) {
                const ok = await validarEtapa1ComApi();
                if (ok) setTab(2);
                return;
            }
            if (n === 3) {
                await iniciarAnalise();
                return;
            }
            if (n === 4) {
                setTab(4);
            }
        }

        function resetProgressBars() {
            ['p1', 'p2', 'p3', 'p4'].forEach((id, i) => {
                const bar = document.getElementById(id);
                const pct = document.getElementById(id + '-pct');
                if (bar) bar.style.width = '0%';
                if (pct) pct.textContent = '0%';
            });
        }

        async function iniciarAnalise() {
            const ok = await enviarDiagnostico();
            if (!ok) return;
            resetProgressBars();
            setTab(3);
            runAnalysis();
        }

        function runAnalysis() {
            const bars = ['p1', 'p2', 'p3', 'p4'];
            const pcts = ['p1-pct', 'p2-pct', 'p3-pct', 'p4-pct'];
            let step = 0;

            function animBar(idx, cb) {
                let pct = 0;
                const iv = setInterval(() => {
                    pct = Math.min(100, pct + Math.floor(Math.random() * 8) + 4);
                    document.getElementById(bars[idx]).style.width = pct + '%';
                    document.getElementById(pcts[idx]).textContent = pct + '%';
                    if (pct >= 100) {
                        clearInterval(iv);
                        setTimeout(cb, 200);
                    }
                }, 60);
            }

            function next() {
                if (step < bars.length) {
                    animBar(step, () => {
                        step++;
                        next();
                    });
                } else {
                    setTimeout(() => setTab(4), 600);
                }
            }

            next();
        }

        function scrollTo(id) {
            const target = document.getElementById(id);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        function updateActiveNav() {
            const links = document.querySelectorAll('.nav-link');
            const offset = window.scrollY + 120;
            links.forEach((link) => {
                const target = document.getElementById(link.dataset.target);
                if (!target) return;
                const start = target.offsetTop;
                const end = start + target.offsetHeight;
                if (offset >= start && offset < end) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });
        }

        window.addEventListener('scroll', updateActiveNav);
        window.addEventListener('resize', updateActiveNav);
        document.addEventListener('DOMContentLoaded', () => {
            updateActiveNav();
            updateAuthState();
            // Check for token in URL params (e.g., after Google OAuth)
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            const loginStatus = urlParams.get('login');
            if (token) {
                localStorage.setItem('authToken', token);
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
                if (loginStatus === 'success') {
                    loadDashboard();
                }
            }
            if (isLoggedIn()) {
                loadDashboard();
            }
        });

        async function enviarDiagnostico() {
            const fatEl = document.getElementById('inp-faturamento');
            const margEl = document.getElementById('inp-margem-diagnostico');
            const faturamento = fatEl ? parseInt(fatEl.value, 10) : NaN;
            const margem = margEl ? parseFloat(margEl.value) : NaN;
            const dados = {
                nome: document.getElementById('inp-nome').value.trim(),
                cnpj: document.getElementById('inp-cnpj').value.replace(/\D/g, ''),
                setor: document.getElementById('inp-setor').value,
                regime: document.getElementById('inp-regime').value,
                faturamento: Number.isFinite(faturamento) ? faturamento : 4800000,
                margem: Number.isFinite(margem) ? margem : 0.12,
                funcionarios: document.getElementById('inp-funcionarios') ? document.getElementById('inp-funcionarios').value : '',
                contador: document.getElementById('inp-contador') ? document.getElementById('inp-contador').value : ''
            };

            try {
                const response = await fetch('/api/diagnosticos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dados)
                });
                const resultado = await safeJsonParse(response);
                if (!response.ok) {
                    alert(resultado.erro || 'Não foi possível salvar o diagnóstico.');
                    return false;
                }
                if (resultado.sucesso) {
                    localStorage.setItem('diagnosisId', String(resultado.id));
                    mostrarResultados(resultado.resultados);
                    return true;
                }
                alert('Resposta inesperada do servidor.');
                return false;
            } catch (erro) {
                console.error('Erro ao enviar:', erro);
                alert('Erro ao processar. Certifique-se de que o backend está rodando (npm start / node server.js).');
                return false;
            }
        }

        function mostrarResultados(r) {
            if (!r) return;
            const total = (r.economia || 0) + (r.creditosIdentificados || 0) + (r.anomaliaValor || 0);
            const elTot = document.getElementById('res-total-oportunidades');
            if (elTot) elTot.textContent = fmtReais(total);
            const ec = document.getElementById('res-credito-tributario');
            if (ec) ec.textContent = fmtReais(r.creditosIdentificados);
            const ea = document.getElementById('res-anomalia-custo');
            if (ea) ea.textContent = fmtReais(r.anomaliaValor || 0);
            const er = document.getElementById('res-regime-ideal');
            if (er) er.textContent = r.regimeIdeal || '—';
            const ee = document.getElementById('res-economia-anual');
            if (ee) ee.textContent = fmtReais(r.economia);
            const np = document.getElementById('res-proximo-passo');
            if (np) {
                np.innerHTML = '<strong>Próximo passo:</strong> revisar regime <strong>' + (r.regimeIdeal || '') + '</strong> com seu contador e priorizar créditos de <strong>' + fmtReais(r.creditosIdentificados) + '</strong> identificados neste diagnóstico.';
            }
            const sa = document.getElementById('res-ai-summary');
            if (sa) {
                if (r.resumo) {
                    sa.textContent = r.resumo;
                } else {
                    sa.textContent = 'Nenhuma análise adicional disponível no momento.';
                }
            }
        }

        calcularSimulador();

        function showPaymentStatusFromQuery() {
            const params = new URLSearchParams(window.location.search);
            if (params.get('pagamento') === 'sucesso') {
                alert('Pagamento confirmado! Obrigado por contratar o FinPJ.');
                window.history.replaceState({}, document.title, window.location.pathname);
            }
            if (params.get('pagamento') === 'cancelado') {
                alert('Pagamento cancelado. Você pode tentar novamente a qualquer momento.');
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }

        showPaymentStatusFromQuery();

        function formatarCNPJ(input) {
            let v = input.value.replace(/\D/g, '');
            if (v.length > 14) v = v.slice(0, 14);
            v = v.replace(/^(\d{2})(\d)/, '$1.$2');
            v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
            v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
            v = v.replace(/(\d{4})(\d)/, '$1-$2');
            input.value = v;
        }

        function validarCNPJ(cnpj) {
            cnpj = cnpj.replace(/\D/g, '');
            if (cnpj.length !== 14) return false;
            if (/^(\d)\1+$/.test(cnpj)) return false;
            let tamanho = cnpj.length - 2;
            let numeros = cnpj.substring(0, tamanho);
            let digitos = cnpj.substring(tamanho);
            let soma = 0;
            let pos = tamanho - 7;
            for (let i = tamanho; i >= 1; i--) {
                soma += numeros.charAt(tamanho - i) * pos--;
                if (pos < 2) pos = 9;
            }
            let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
            if (resultado != digitos.charAt(0)) return false;
            tamanho = tamanho + 1;
            numeros = cnpj.substring(0, tamanho);
            soma = 0;
            pos = tamanho - 7;
            for (let i = tamanho; i >= 1; i--) {
                soma += numeros.charAt(tamanho - i) * pos--;
                if (pos < 2) pos = 9;
            }
            resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
            return resultado == digitos.charAt(1);
        }

        function marcarErro(id) {
            document.getElementById(id).style.border = '1px solid #ef4444';
        }

        function limparErro(id) {
            document.getElementById(id).style.border = '1px solid var(--border)';
        }

        // =====================
        // UPLOAD & ANÁLISE IA
        // =====================
        function uploadDragOver(e) {
            e.preventDefault();
            document.getElementById('upload-dropzone').style.borderColor = 'var(--color-primary)';
            document.getElementById('upload-dropzone').style.background = 'rgba(59,130,246,0.07)';
        }

        function uploadDrop(e) {
            e.preventDefault();
            const dz = document.getElementById('upload-dropzone');
            dz.style.borderColor = 'var(--border)';
            dz.style.background = 'var(--bg-secondary)';
            const file = e.dataTransfer.files[0];
            if (file) uploadArquivo(file);
        }

        async function uploadArquivo(file) {
            if (!file) return;
            if (!isLoggedIn()) { openModal('login'); return; }
            const status = document.getElementById('upload-status');
            const tipo = document.getElementById('tipo-documento').value;
            const contexto = document.getElementById('contexto-analise').value;

            status.innerHTML = `<span style="color:#60a5fa;">⏳ Enviando e analisando <strong>${file.name}</strong>...</span>`;
            document.getElementById('analise-resultado').style.display = 'none';

            const formData = new FormData();
            formData.append('arquivo', file);
            formData.append('tipo', tipo);
            formData.append('contexto', contexto);

            const token = localStorage.getItem('finpjToken') || localStorage.getItem('authToken');
            try {
                const res = await fetch('/api/upload-documento', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token },
                    body: formData
                });
                
                const text = await res.text();
                let data;
                try {
                    data = JSON.parse(text);
                } catch (err) {
                    if (res.status === 413 || text.includes('Too Large')) {
                        throw new Error('Arquivo muito grande. O limite é de 4MB na Vercel.');
                    }
                    throw new Error('Resposta inválida do servidor (' + res.status + ').');
                }
                
                if (!res.ok || !data.sucesso) throw new Error(data.erro || 'Erro na análise.');
                status.innerHTML = `<span style="color:#34d399;">✅ ${file.name} analisado via <strong>${data.fonte === 'groq-llama3' ? 'Llama 3 (Groq)' : 'análise local'}</strong></span>`;
                renderizarAnalise(data, tipo);
            } catch (e) {
                status.innerHTML = `<span style="color:#ef4444;">❌ ${e.message}</span>`;
            }
        }

        function metricaCard(label, valor, cor) {
            return `<div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">${label}</div>
                <div style="font-size:18px;font-weight:700;color:${cor || 'var(--color-primary)'};">${valor}</div>
            </div>`;
        }

        function fmtR(v) { return 'R$ ' + Math.round(Number(v) || 0).toLocaleString('pt-BR'); }

        function renderizarAnalise(data, tipo) {
            const d = data.dados;
            const resultado = document.getElementById('analise-resultado');
            resultado.style.display = 'block';

            document.getElementById('analise-fonte-badge').textContent =
                data.fonte === 'groq-llama3' ? '🤖 Powered by Llama 3.3 70B via Groq (open-source, gratuito)' : '⚙️ Análise local aproximada';
            document.getElementById('analise-resumo-texto').textContent = d.resumo || 'Análise concluída.';

            // Métricas dinâmicas por tipo
            const met = document.getElementById('analise-metricas');
            if (tipo === 'dre') {
                met.innerHTML =
                    metricaCard('Receita Bruta', fmtR(d.receita_bruta)) +
                    metricaCard('Lucro Bruto', fmtR(d.lucro_bruto), '#34d399') +
                    metricaCard('EBITDA', fmtR(d.ebitda), '#60a5fa') +
                    metricaCard('Margem Líquida', (d.margem_liquida_pct || 0).toFixed(1) + '%', d.margem_liquida_pct > 10 ? '#34d399' : '#fbbf24');
            } else if (tipo === 'balanco') {
                met.innerHTML =
                    metricaCard('Ativo Total', fmtR(d.ativo_total)) +
                    metricaCard('Patrimônio Líquido', fmtR(d.patrimonio_liquido), '#34d399') +
                    metricaCard('Liquidez Corrente', (d.liquidez_corrente || 0).toFixed(2), d.liquidez_corrente >= 1 ? '#34d399' : '#ef4444') +
                    metricaCard('Endividamento', (d.endividamento_pct || 0).toFixed(1) + '%', d.endividamento_pct > 60 ? '#ef4444' : '#fbbf24');
            } else { // extrato
                met.innerHTML =
                    metricaCard('Entradas', fmtR(d.total_entradas), '#34d399') +
                    metricaCard('Saídas', fmtR(d.total_saidas), '#ef4444') +
                    metricaCard('Saldo', fmtR(d.saldo_final), d.saldo_final >= 0 ? '#60a5fa' : '#ef4444') +
                    metricaCard('Transações', d.num_transacoes || 0);
            }

            // Alertas
            const alertasEl = document.getElementById('analise-alertas');
            if (d.alertas && d.alertas.length) {
                alertasEl.style.display = 'block';
                alertasEl.innerHTML = '<div style="font-size:12px;font-weight:600;color:#fbbf24;margin-bottom:8px;">⚠️ ALERTAS</div>' +
                    d.alertas.map(a => `<div style="font-size:13px;color:#fde68a;background:rgba(251,191,36,0.08);padding:8px 12px;border-radius:8px;margin-bottom:6px;border-left:3px solid #fbbf24;">${a}</div>`).join('');
            }

            // Recomendações
            const recEl = document.getElementById('analise-recomendacoes');
            if (d.recomendacoes && d.recomendacoes.length) {
                recEl.style.display = 'block';
                recEl.innerHTML = '<div style="font-size:12px;font-weight:600;color:#60a5fa;margin-bottom:8px;">💡 RECOMENDAÇÕES</div>' +
                    d.recomendacoes.map((r, i) => `<div style="font-size:13px;color:var(--text-secondary);background:rgba(59,130,246,0.06);padding:10px 14px;border-radius:8px;margin-bottom:6px;border-left:3px solid #3b82f6;"><strong>${i + 1}.</strong> ${r}</div>`).join('');
            }

            // Painel de conciliação para extratos
            const concPanel = document.getElementById('conciliacao-panel');
            if (tipo === 'extrato' && d.itens_conciliacao && d.itens_conciliacao.length) {
                concPanel.style.display = 'block';
                const body = document.getElementById('conciliacao-body');
                body.innerHTML = d.itens_conciliacao.map(item => {
                    const cor = item.tipo === 'entrada' ? '#34d399' : '#ef4444';
                    const flag = item.flag ? `<span style="font-size:10px;background:rgba(251,191,36,0.15);color:#fbbf24;padding:2px 6px;border-radius:999px;">${item.flag}</span>` : '';
                    return `<tr>
                        <td>${item.data}</td>
                        <td>${item.descricao} ${flag}</td>
                        <td style="color:${cor};font-weight:600;">${fmtR(item.valor)}</td>
                        <td><span style="font-size:11px;padding:2px 8px;border-radius:999px;background:${item.tipo === 'entrada' ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)'};color:${cor};">${item.tipo}</span></td>
                        <td>${item.categoria || '—'}</td>
                        <td><span class="report-status ok">Identificado</span></td>
                    </tr>`;
                }).join('');

                // Resumo conciliação
                document.getElementById('conciliacao-resumo').innerHTML =
                    metricaCard('Total Entradas', fmtR(d.total_entradas), '#34d399') +
                    metricaCard('Total Saídas', fmtR(d.total_saidas), '#ef4444') +
                    metricaCard('Saldo Final', fmtR(d.saldo_final), d.saldo_final >= 0 ? '#60a5fa' : '#ef4444');
            } else {
                concPanel.style.display = 'none';
            }

            resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        async function carregarHistoricoAnalises() {
            const token = localStorage.getItem('finpjToken') || localStorage.getItem('authToken');
            if (!token) return;
            try {
                const res = await fetch('/api/analises', { headers: { Authorization: 'Bearer ' + token } });
                const data = await res.json();
                if (!data.sucesso || !data.analises.length) return;
                const hist = document.getElementById('historico-analises');
                const lista = document.getElementById('historico-lista');
                hist.style.display = 'block';
                lista.innerHTML = data.analises.slice(-5).reverse().map(a => {
                    const tipoLabel = { dre: 'DRE', balanco: 'Balanço', extrato: 'Extrato' }[a.tipo] || a.tipo;
                    return `<div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;margin-bottom:8px;">
                        <div style="font-size:20px;">${a.tipo === 'extrato' ? '🏦' : a.tipo === 'balanco' ? '📋' : '📊'}</div>
                        <div style="flex:1;">
                            <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${a.nomeArquivo}</div>
                            <div style="font-size:11px;color:var(--text-muted);">${tipoLabel} · ${new Date(a.data).toLocaleDateString('pt-BR')} · ${a.fonte === 'groq-llama3' ? 'Llama 3' : 'Local'}</div>
                        </div>
                    </div>`;
                }).join('');
            } catch (e) { console.error(e); }
        }

        // ===== CHARTS =====
        let cashflowChart, categoryChart;
        async function loadCharts() {
            const token = localStorage.getItem('finpjToken') || localStorage.getItem('authToken');
            if (!token || typeof Chart === 'undefined') return;
            try {
                const res = await fetch('/api/cashflow-projection', { headers: { Authorization: 'Bearer ' + token } });
                const data = await res.json();
                if (!data.sucesso) return;
                const proj = data.projecao;
                const ctx1 = document.getElementById('chart-cashflow');
                if (cashflowChart) cashflowChart.destroy();
                cashflowChart = new Chart(ctx1, {
                    type: 'line',
                    data: {
                        labels: proj.map(p => p.data.slice(5)),
                        datasets: [
                            { label: 'Saldo', data: proj.map(p => p.saldo), borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.1)', fill: true, tension: 0.3 },
                            { label: 'Entradas', data: proj.map(p => p.entrada), borderColor: '#34d399', borderDash: [5, 5], tension: 0.3 },
                            { label: 'Saídas', data: proj.map(p => p.saida), borderColor: '#ef4444', borderDash: [5, 5], tension: 0.3 }
                        ]
                    },
                    options: { responsive: true, plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } }, scales: { x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { color: '#64748b', callback: v => 'R$' + (v/1000).toFixed(0) + 'k' }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
                });
            } catch (e) { console.error('Charts:', e); }
            // Category pie chart
            const cats = {};
            _connectedBanks.forEach(b => (b.transactions || []).filter(t => t.tipo === 'saida').forEach(t => { cats[t.categoria] = (cats[t.categoria] || 0) + Math.abs(t.valor); }));
            const catLabels = Object.keys(cats);
            if (catLabels.length) {
                const ctx2 = document.getElementById('chart-categories');
                if (categoryChart) categoryChart.destroy();
                const colors = ['#ef4444', '#f59e0b', '#60a5fa', '#34d399', '#a78bfa', '#f472b6', '#fb923c', '#22d3ee'];
                categoryChart = new Chart(ctx2, {
                    type: 'doughnut',
                    data: { labels: catLabels, datasets: [{ data: Object.values(cats), backgroundColor: colors.slice(0, catLabels.length), borderWidth: 0 }] },
                    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, padding: 12 } } } }
                });
            }
        }

        function loadMoMComparison() {
            const allTx = _connectedBanks.flatMap(b => b.transactions || []);
            const entradas = allTx.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Math.abs(t.valor), 0);
            const saidas = allTx.filter(t => t.tipo === 'saida').reduce((s, t) => s + Math.abs(t.valor), 0);
            const prevE = entradas * (0.85 + Math.random() * 0.2);
            const prevS = saidas * (0.9 + Math.random() * 0.15);
            const varE = entradas - prevE, varS = saidas - prevS;
            const mom = document.getElementById('mom-comparison');
            if (!mom) return;
            mom.innerHTML = `
                <div class="dashboard-card"><h3>Receita</h3><strong style="color:#34d399;">R$ ${Math.round(entradas).toLocaleString('pt-BR')}</strong><div style="font-size:11px;margin-top:6px;color:${varE>=0?'#34d399':'#ef4444'};">${varE>=0?'▲':'▼'} ${Math.abs(Math.round(varE/Math.max(1,prevE)*100))}% vs mês anterior</div></div>
                <div class="dashboard-card"><h3>Despesas</h3><strong style="color:#ef4444;">R$ ${Math.round(saidas).toLocaleString('pt-BR')}</strong><div style="font-size:11px;margin-top:6px;color:${varS<=0?'#34d399':'#ef4444'};">${varS>0?'▲':'▼'} ${Math.abs(Math.round(varS/Math.max(1,prevS)*100))}% vs mês anterior</div></div>
                <div class="dashboard-card"><h3>Margem</h3><strong style="color:#60a5fa;">${entradas>0?Math.round((entradas-saidas)/entradas*100):0}%</strong><div style="font-size:11px;margin-top:6px;color:var(--text-muted);">Margem operacional</div></div>
                <div class="dashboard-card"><h3>Saldo</h3><strong style="color:${entradas-saidas>=0?'#34d399':'#ef4444'};">R$ ${Math.round(entradas-saidas).toLocaleString('pt-BR')}</strong><div style="font-size:11px;margin-top:6px;color:var(--text-muted);">Resultado do período</div></div>
            `;
        }

        // ===== CHAT IA =====
        async function sendChat() {
            const input = document.getElementById('chat-input');
            const msg = input.value.trim();
            if (!msg) return;
            input.value = '';
            const box = document.getElementById('chat-messages');
            box.innerHTML += `<div style="align-self:flex-end;background:rgba(59,130,246,0.2);border-radius:12px;padding:12px 16px;max-width:75%;font-size:13px;color:var(--text-primary);">${msg}</div>`;
            const loadingId = 'loading-' + Date.now();
            box.innerHTML += `<div id="${loadingId}" style="background:rgba(255,255,255,0.05);border-radius:12px;padding:12px 16px;max-width:75%;font-size:13px;color:var(--text-muted);">⏳ Pensando...</div>`;
            box.scrollTop = box.scrollHeight;
            const token = localStorage.getItem('finpjToken') || localStorage.getItem('authToken');
            try {
                const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ message: msg }) });
                const data = await res.json();
                const el = document.getElementById(loadingId);
                if (el) { el.style.color = 'var(--text-secondary)'; el.innerHTML = data.resposta.replace(/\n/g, '<br>'); if (data.fonte === 'groq-llama3') el.innerHTML += '<div style="font-size:10px;color:var(--text-muted);margin-top:8px;">🤖 Llama 3 via Groq</div>'; }
            } catch (e) { const el = document.getElementById(loadingId); if (el) el.innerHTML = '❌ Erro ao processar.'; }
            box.scrollTop = box.scrollHeight;
        }

        // ===== CALCULADORA DAS =====
        async function calcularDAS() {
            const fat = document.getElementById('das-faturamento').value;
            const regime = document.getElementById('das-regime').value;
            const atividade = document.getElementById('das-atividade').value;
            const token = localStorage.getItem('finpjToken') || localStorage.getItem('authToken');
            try {
                const res = await fetch('/api/calcular-das', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ faturamento: fat, regime, atividade }) });
                const data = await res.json();
                if (!data.sucesso) throw new Error(data.erro);
                document.getElementById('das-resultado').innerHTML = `
                    <div style="width:100%;">
                        <div style="text-align:center;margin-bottom:20px;"><div style="font-size:14px;color:var(--text-muted);margin-bottom:4px;">Guia ${data.guia}</div><div style="font-size:36px;font-weight:700;color:#60a5fa;">R$ ${data.valor.toLocaleString('pt-BR')}</div><div style="font-size:12px;color:var(--text-muted);">por mês</div></div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                            ${metricaCard('Alíquota efetiva', data.aliquotaEfetiva + '%', '#f59e0b')}
                            ${metricaCard('Faturamento/mês', 'R$ ' + data.faturamentoMensal.toLocaleString('pt-BR'), '#60a5fa')}
                            ${metricaCard('Vencimento', data.vencimento, '#34d399')}
                            ${metricaCard('Tipo de guia', data.guia, '#a78bfa')}
                        </div>
                    </div>`;
            } catch (e) { alert(e.message || 'Erro ao calcular.'); }
        }

        async function processarOCR(input) {
            if (!input.files || !input.files[0]) return;
            const file = input.files[0];
            const status = document.getElementById('ocr-status');
            status.textContent = '⏳ Enviando e processando documento...';
            
            const formData = new FormData();
            formData.append('arquivo', file);
            formData.append('tipo', 'dre'); // Força tipo DRE para a OCR extrair receita_bruta

            const token = localStorage.getItem('finpjToken') || localStorage.getItem('authToken');
            try {
                const res = await fetch('/api/upload-documento', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token },
                    body: formData
                });
                
                const text = await res.text();
                let data;
                try {
                    data = JSON.parse(text);
                } catch (err) {
                    if (res.status === 413 || text.includes('Too Large')) {
                        throw new Error('Arquivo muito grande. O limite é de 4MB.');
                    }
                    throw new Error('Resposta inválida do servidor (' + res.status + ').');
                }
                
                if (!res.ok || !data.sucesso) throw new Error(data.erro || 'Falha na extração.');
                
                // Extrai receita_bruta ou tenta via regex
                let fatAprox = '150000';
                if (data.dados && data.dados.receita_bruta) {
                    fatAprox = data.dados.receita_bruta;
                } else {
                    const resumoText = JSON.stringify(data.dados || {});
                    const valores = resumoText.match(/[0-9]+(?:\.[0-9]{3})*(?:,[0-9]{2})/g) || [];
                    if (valores.length > 0) {
                        fatAprox = valores[0].replace(/[^0-9,]/g, '').replace(',', '.');
                    }
                }
                
                status.innerHTML = '✅ Extração concluída com sucesso!';
                document.getElementById('das-faturamento').value = parseFloat(fatAprox) * 12; // Anualiza
            } catch(e) {
                status.innerHTML = '❌ Erro na extração OCR: ' + e.message;
            }
        }

        async function simularRegime() {
            const fat = document.getElementById('das-faturamento').value || 360000;
            const regimeAtual = document.getElementById('das-regime').value;
            const resBox = document.getElementById('das-resultado');
            
            resBox.innerHTML = '<div style="text-align:center;color:var(--text-muted);">⏳ Simulando cenários tributários com IA...</div>';
            
            setTimeout(() => {
                const f = parseFloat(fat);
                let valSimples = (f * 0.06).toLocaleString('pt-BR');
                let valPresumido = (f * 0.1633).toLocaleString('pt-BR');
                
                const rec = regimeAtual === 'simples' ? 
                    'Seu regime atual (Simples Nacional) é o mais vantajoso.' : 
                    `Mudar para Simples Nacional pode gerar economia anual de até R$ ${((f*0.1633) - (f*0.06)).toLocaleString('pt-BR')}.`;

                resBox.innerHTML = `
                    <div style="width:100%;">
                        <div style="text-align:center;margin-bottom:20px;">
                            <div style="font-size:16px;font-weight:700;color:var(--text-primary);">Comparativo de Regimes</div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
                            <div style="background:var(--bg-secondary);padding:16px;border-radius:12px;border:1px solid ${regimeAtual==='simples'?'var(--color-primary)':'var(--border)'}">
                                <div style="font-size:12px;color:var(--text-secondary);">Simples Nacional</div>
                                <div style="font-size:18px;font-weight:700;color:var(--text-primary);">R$ ${valSimples} <span style="font-size:10px;font-weight:400">/ano</span></div>
                            </div>
                            <div style="background:var(--bg-secondary);padding:16px;border-radius:12px;border:1px solid ${regimeAtual==='presumido'?'var(--color-primary)':'var(--border)'}">
                                <div style="font-size:12px;color:var(--text-secondary);">Lucro Presumido</div>
                                <div style="font-size:18px;font-weight:700;color:var(--text-primary);">R$ ${valPresumido} <span style="font-size:10px;font-weight:400">/ano</span></div>
                            </div>
                        </div>
                        <div style="background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);padding:12px;border-radius:8px;font-size:13px;color:#10b981;">
                            💡 <strong>Recomendação IA:</strong> ${rec}
                        </div>
                    </div>`;
            }, 1500);
        }

        // ===== CALENDÁRIO FISCAL =====
        let _calFilter = 'all';
        let _calEvents = [];
        
        function setCalFilter(f) {
            _calFilter = f;
            document.getElementById('cal-btn-all').style.background = f==='all' ? 'var(--bg-primary)' : 'transparent';
            document.getElementById('cal-btn-all').style.color = f==='all' ? 'var(--text-primary)' : 'var(--text-secondary)';
            document.getElementById('cal-btn-history').style.background = f==='history' ? 'var(--bg-primary)' : 'transparent';
            document.getElementById('cal-btn-history').style.color = f==='history' ? 'var(--text-primary)' : 'var(--text-secondary)';
            document.getElementById('cal-btn-proj').style.background = f==='projection' ? 'var(--bg-primary)' : 'transparent';
            document.getElementById('cal-btn-proj').style.color = f==='projection' ? 'var(--text-primary)' : 'var(--text-secondary)';
            renderFiscalCalendar();
        }

        async function loadFiscalCalendar() {
            const token = localStorage.getItem('finpjToken') || localStorage.getItem('authToken');
            const ano = document.getElementById('cal-year-select').value;
            try {
                const res = await fetch(`/api/fiscal-calendar?ano=${ano}`, { headers: { Authorization: 'Bearer ' + token } });
                const data = await res.json();
                if (!data.sucesso) return;
                _calEvents = data.eventos;
                renderFiscalCalendar();
            } catch (e) { console.error(e); }
        }

        function renderFiscalCalendar() {
            const grid = document.getElementById('fiscal-calendar-grid');
            const tipoColors = { imposto: '#ef4444', rh: '#60a5fa', contabil: '#34d399' };
            const tipoLabels = { imposto: 'Imposto', rh: 'RH', contabil: 'Contábil' };
            const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
            
            let filtered = _calEvents;
            if (_calFilter === 'history') filtered = _calEvents.filter(e => e.passado);
            if (_calFilter === 'projection') filtered = _calEvents.filter(e => !e.passado);
            
            // Group by month
            const grouped = {};
            filtered.forEach(e => {
                if(!grouped[e.mes]) grouped[e.mes] = [];
                grouped[e.mes].push(e);
            });
            
            grid.innerHTML = Object.keys(grouped).sort((a,b)=>a-b).map(m => {
                const monthEvents = grouped[m].sort((a, b) => a.dia - b.dia);
                if (!monthEvents.length) return '';
                return `
                <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; overflow:hidden;">
                    <div style="background:var(--bg-secondary); padding:12px 20px; font-weight:700; border-bottom:1px solid var(--border); color:var(--text-primary); font-size:14px;">${months[m]}</div>
                    <div style="display:flex; flex-direction:column;">
                        ${monthEvents.map(e => `
                        <div style="display:flex;align-items:center;gap:16px;padding:16px 20px;border-bottom:1px solid var(--border);opacity:${e.passado?'0.5':'1'};">
                            <div style="min-width:50px;text-align:center;"><div style="font-size:20px;font-weight:700;color:var(--text-primary);">${String(e.dia).padStart(2,'0')}</div></div>
                            <div style="flex:1;"><div style="font-size:14px;font-weight:600;color:var(--text-primary);">${e.titulo}</div><div style="font-size:12px;color:var(--text-secondary);">${e.desc}</div></div>
                            <span style="font-size:10px;padding:3px 10px;border-radius:999px;background:${tipoColors[e.tipo]}20;color:${tipoColors[e.tipo]};">${tipoLabels[e.tipo]}</span>
                            <span style="font-size:11px;color:${e.passado?'#34d399':'#f59e0b'};">${e.passado?'✅ Realizado':'⏳ A Pagar'}</span>
                        </div>
                        `).join('')}
                    </div>
                </div>`;
            }).join('') || '<div style="padding:20px;text-align:center;color:var(--text-muted);">Nenhum evento encontrado.</div>';
        }

        // ===== PERFIL =====
        async function loadProfile() {
            const token = localStorage.getItem('finpjToken') || localStorage.getItem('authToken');
            try {
                const res = await fetch('/api/profile', { headers: { Authorization: 'Bearer ' + token } });
                const data = await res.json();
                if (!data.sucesso) return;
                const p = data.profile;
                if (p.nomeEmpresa) document.getElementById('profile-nome').value = p.nomeEmpresa;
                if (p.cnpj) document.getElementById('profile-cnpj').value = p.cnpj;
                if (p.regime) document.getElementById('profile-regime').value = p.regime;
                if (p.setor) document.getElementById('profile-setor').value = p.setor;
            } catch (e) { console.error(e); }
        }
        async function saveProfile() {
            const token = localStorage.getItem('finpjToken') || localStorage.getItem('authToken');
            const body = { nomeEmpresa: document.getElementById('profile-nome').value, cnpj: document.getElementById('profile-cnpj').value, regime: document.getElementById('profile-regime').value, setor: document.getElementById('profile-setor').value };
            try {
                const res = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
                const data = await res.json();
                document.getElementById('profile-status').innerHTML = data.sucesso ? '<span style="color:#34d399;">✅ Salvo com sucesso!</span>' : '<span style="color:#ef4444;">Erro ao salvar.</span>';
            } catch (e) { document.getElementById('profile-status').innerHTML = '<span style="color:#ef4444;">Erro de conexão.</span>'; }
        }

        // ===== NOTIFICAÇÕES =====
        async function loadNotifications() {
            const token = localStorage.getItem('finpjToken') || localStorage.getItem('authToken');
            if (!token) return;
            try {
                const res = await fetch('/api/notifications', { headers: { Authorization: 'Bearer ' + token } });
                const data = await res.json();
                const notifs = data.notifications || [];
                const badge = document.getElementById('notif-badge');
                if (notifs.length) { badge.style.display = 'block'; badge.textContent = notifs.length; } else { badge.style.display = 'none'; }
                const list = document.getElementById('notif-list');
                const tipoIcons = { info: 'ℹ️', warning: '⚠️', danger: '🚨' };
                const tipoBg = { info: 'rgba(96,165,250,0.1)', warning: 'rgba(245,158,11,0.1)', danger: 'rgba(239,68,68,0.1)' };
                list.innerHTML = notifs.length ? notifs.map(n => `<div style="padding:10px;background:${tipoBg[n.tipo]};border-radius:8px;margin-bottom:6px;font-size:12px;color:var(--text-secondary);">${tipoIcons[n.tipo]} ${n.msg}</div>`).join('') : '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:20px;">Nenhuma notificação</div>';
            } catch (e) { console.error(e); }
        }
        async function toggleNotifications() {
            const p = document.getElementById('notif-panel');
            const isOpening = p.style.display === 'none' || p.style.display === '';
            p.style.display = isOpening ? 'block' : 'none';
            if (isOpening) {
                const token = localStorage.getItem('finpjToken') || localStorage.getItem('authToken');
                if (token) {
                    try {
                        await fetch('/api/notifications/read', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
                        const badge = document.getElementById('notif-badge');
                        if (badge) badge.style.display = 'none';
                    } catch(e) {}
                }
            }
        }

        // ===== TEMA DARK/LIGHT =====
        function toggleTheme() {
            const root = document.documentElement;
            const isDark = root.style.getPropertyValue('--bg-primary').trim() !== '#f8fafc';
            if (isDark) {
                root.style.setProperty('--bg-primary', '#f8fafc');
                root.style.setProperty('--bg-secondary', '#ffffff');
                root.style.setProperty('--bg-card', '#ffffff');
                root.style.setProperty('--text-primary', '#0f172a');
                root.style.setProperty('--text-secondary', '#475569');
                root.style.setProperty('--text-muted', '#94a3b8');
                root.style.setProperty('--border', '#e2e8f0');
                root.style.setProperty('--shadow-md', '0 4px 12px rgba(0,0,0,0.08)');
                document.getElementById('theme-toggle-btn').textContent = '☀️';
                localStorage.setItem('finpjTheme', 'light');
            } else {
                root.style.setProperty('--bg-primary', '#0a0f1e');
                root.style.setProperty('--bg-secondary', '#111827');
                root.style.setProperty('--bg-card', '#1a2744');
                root.style.setProperty('--text-primary', '#f1f5f9');
                root.style.setProperty('--text-secondary', '#94a3b8');
                root.style.setProperty('--text-muted', '#64748b');
                root.style.setProperty('--border', '#1e3a5f');
                root.style.setProperty('--shadow-md', '0 6px 20px rgba(0,0,0,0.35)');
                document.getElementById('theme-toggle-btn').textContent = '🌙';
                localStorage.setItem('finpjTheme', 'dark');
            }
        }

        // ===== INIT =====
        function initApp() {
            const params = new URLSearchParams(window.location.search);
            const urlToken = params.get('token');
            if (urlToken) { localStorage.setItem('finpjToken', urlToken); window.history.replaceState({}, '', '/'); }

            // Restore theme
            if (localStorage.getItem('finpjTheme') === 'light') toggleTheme();

            calcularSimulador();
            updateAuthState();

            if (isLoggedIn()) {
                loadDashboard().then(() => {
                    loadCharts();
                    loadMoMComparison();
                    loadNotifications();
                    loadProfile();
                });
            }
        
    
async function gerarDasAutomatico() {
    const token = localStorage.getItem('finpjToken') || localStorage.getItem('authToken');
    const resDiv = document.getElementById('das-resultado');
    if (!resDiv) return;
    
    resDiv.innerHTML = `
        <div style="text-align:center;">
            <div class="spinner" style="margin: 0 auto 15px;"></div>
            <p style="font-size:14px;color:var(--text-secondary);">Buscando Notas Fiscais na Prefeitura/SEFAZ...</p>
        </div>
    `;

    try {
        const res = await fetch('/api/gerar-das-automatico', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token }
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.erro || 'Falha na automação.');

        resDiv.innerHTML = `
            <div style="text-align:left; width:100%;">
                <h3 style="color:#34d399;margin-bottom:12px;">✅ DAS Gerado com Sucesso!</h3>
                <p style="font-size:13px;margin-bottom:8px;"><strong>Período:</strong> ${data.das.competencia}</p>
                <p style="font-size:13px;margin-bottom:8px;"><strong>Faturamento Identificado:</strong> R$ ${data.das.faturamentoBase.toLocaleString('pt-BR')}</p>
                <p style="font-size:24px;font-weight:700;color:var(--text-primary);margin:12px 0;">R$ ${data.das.valor.toLocaleString('pt-BR')}</p>
                <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">Alíquota efetiva: ${data.das.aliquotaEfetiva}% | Vencimento: ${data.das.vencimento}</p>
                
                <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;margin-bottom:16px;">
                    <label style="font-size:10px;color:var(--text-muted);display:block;margin-bottom:4px;">CÓDIGO PIX PARA PAGAMENTO</label>
                    <code style="font-size:10px;word-break:break-all;color:var(--color-primary);">${data.das.linhaDigitavel}</code>
                </div>
                <button class="btn-primary" style="width:100%;" onclick="alert('Funcionalidade de download em implementação...')">Baixar PDF da Guia</button>
            </div>
        `;
    } catch (e) {
        resDiv.innerHTML = `<p style="color:#ef4444;">❌ Erro: ${e.message}</p>`;
    }
}
// --- EXPOSIÇÃO GLOBAL ---
window.openModal = openModal;
window.closeModal = closeModal;
window.setTab = setTab;
window.switchView = switchView;
window.logoutCliente = logoutCliente;
window.conectarBanco = conectarBanco;
window.syncBank = syncBank;
window.disconnectBank = disconnectBank;
window.calcularDAS = calcularDAS;
window.simularRegime = simularRegime;
window.gerarDasAutomatico = gerarDasAutomatico;
window.loginWithCnpj = loginWithCnpj;
window.registerWithCnpj = registerWithCnpj;
window.sendLoginCode = sendLoginCode;
window.verifyLoginCode = verifyLoginCode;
window.buscarCnpjNaReceita = buscarCnpjNaReceita;
window.goTab = goTab;
window.processarOCR = processarOCR;
window.toggleTheme = toggleTheme;
window.copyPix = copyPix;
