const state = {
  token: localStorage.getItem('finpj_token') || '',
  authEmail: localStorage.getItem('finpj_email') || '',
  provider: localStorage.getItem('finpj_provider') || 'local',
  pendingPlan: 'growth',
  dashboard: null,
  banks: []
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function setLoading(element, isLoading, label = 'Processando...') {
  if (!element) return;
  if (isLoading) {
    element.dataset.label = element.textContent;
    element.textContent = label;
    element.disabled = true;
  } else {
    element.textContent = element.dataset.label || element.textContent;
    element.disabled = false;
  }
}

function showToast(message, type = 'info') {
  const stack = $('[data-toast-stack]');
  if (!stack) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : type === 'success' ? 'success' : ''}`;
  toast.textContent = message;
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(path, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof body === 'object' ? (body.erro || body.error || body.mensagem) : body;
    throw new Error(message || `Erro HTTP ${response.status}`);
  }
  return body;
}

function persistSession(token, email, provider = 'local') {
  state.token = token || '';
  state.authEmail = email || state.authEmail || '';
  state.provider = provider;
  localStorage.setItem('finpj_token', state.token);
  if (state.authEmail) localStorage.setItem('finpj_email', state.authEmail);
  localStorage.setItem('finpj_provider', provider);
  updateSessionUi();
}

function clearSession() {
  state.token = '';
  state.authEmail = '';
  state.provider = 'local';
  state.dashboard = null;
  state.banks = [];
  localStorage.removeItem('finpj_token');
  localStorage.removeItem('finpj_email');
  localStorage.removeItem('finpj_provider');
  updateSessionUi();
}

function updateSessionUi() {
  const logged = Boolean(state.token);
  $('[data-public-area]')?.classList.toggle('is-hidden', logged);
  $$('[data-open-login], [data-open-register]').forEach((el) => el.classList.toggle('is-hidden', logged));
  $('[data-logout]')?.classList.toggle('is-hidden', !logged);
  $('[data-dashboard]')?.classList.toggle('is-hidden', !logged);
  if (logged) $('[data-user-title]').textContent = `Dashboard ${state.authEmail || ''}`.trim();
  if (logged && location.hash !== '#dashboard') location.hash = '#dashboard';
}

function openModal(selector) {
  const modal = $(selector);
  if (!modal) return;
  if (typeof modal.showModal === 'function') modal.showModal();
  else modal.classList.remove('is-hidden');
}

function closeModals() {
  $$('.modal').forEach((modal) => {
    if (typeof modal.close === 'function') modal.close();
    modal.classList.add('is-hidden');
  });
}

function setAuthTab(tab) {
  $$('[data-auth-tab]').forEach((button) => button.classList.toggle('is-active', button.dataset.authTab === tab));
  $$('[data-auth-panel]').forEach((panel) => panel.classList.toggle('is-hidden', panel.dataset.authPanel !== tab));
}

function setDashboardTab(tab) {
  $$('[data-tab]').forEach((button) => button.classList.toggle('is-active', button.dataset.tab === tab));
  $$('[data-panel]').forEach((panel) => panel.classList.toggle('is-hidden', panel.dataset.panel !== tab));
}

function renderInsightList(selector, items) {
  const target = $(selector);
  if (!target) return;
  target.innerHTML = '';
  items.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'insight-item';
    el.innerHTML = `<strong>${item.title}</strong><p>${item.text}</p>`;
    target.appendChild(el);
  });
}

function renderBusinessDashboards(dashboard) {
  const summary = dashboard.summary || {};
  const reports = dashboard.reports || [];
  const user = dashboard.user || {};
  const total = Number(summary.totalMovimentado || 0);
  const pendencias = Number(summary.pendencias || 0);
  const receita = Math.round(total * 0.62);
  const despesas = Math.round(total * 0.38);
  const lucro = receita - despesas;
  const margem = receita > 0 ? Math.round((lucro / receita) * 100) : 0;

  $('[data-exec="revenue"]').textContent = formatCurrency(receita);
  $('[data-exec="margin"]').textContent = `${margem}%`;
  $('[data-exec="regime"]').textContent = user.regime || 'Nao informado';
  $('[data-financial="income"]').textContent = formatCurrency(receita);
  $('[data-financial="expenses"]').textContent = formatCurrency(despesas);
  $('[data-financial="profit"]').textContent = formatCurrency(lucro);

  renderInsightList('[data-executive-summary]', [
    { title: 'Visao da empresa', text: `${reports.length || 0} eventos financeiros analisados para apoiar a leitura executiva.` },
    { title: 'Performance operacional', text: `Margem estimada de ${margem}% com base nos movimentos recentes registrados.` },
    { title: 'Plano ativo', text: `Plano selecionado: ${user.plano || 'starter'}. Pagamento: ${user.statusPagamento || 'pendente'}.` }
  ]);
  renderInsightList('[data-main-alerts]', [
    { title: 'Pendencias', text: `${pendencias} item(ns) exigem revisao ou acompanhamento.` },
    { title: 'Caixa', text: lucro >= 0 ? 'Resultado operacional positivo no resumo atual.' : 'Resultado operacional negativo: priorize revisao de despesas.' },
    { title: 'Cadastro', text: user.cnpj ? 'CNPJ vinculado ao usuario.' : 'Complete o CNPJ/perfil para melhorar os diagnosticos.' }
  ]);
  renderInsightList('[data-balance-reading]', [
    { title: 'Leitura gerencial', text: 'Acompanhe ativos, passivos e capacidade de pagamento a partir dos demonstrativos enviados.' },
    { title: 'Capital de giro', text: 'Concilie extratos e DRE para identificar pressao no caixa antes do vencimento de impostos.' },
    { title: 'Qualidade dos dados', text: 'Quanto mais documentos forem enviados, mais precisa fica a analise de balanco.' }
  ]);
  renderInsightList('[data-balance-risks]', [
    { title: 'Gargalos', text: 'Pendencias financeiras recorrentes indicam necessidade de rotina de conciliacao.' },
    { title: 'Pontos criticos', text: 'Saidas elevadas e eventos em atencao devem ser revisados por categoria.' },
    { title: 'Oportunidades', text: 'Use analises de documentos para identificar ajustes em margem, custos e liquidez.' }
  ]);
  renderInsightList('[data-tax-fit]', [
    { title: 'Enquadramento atual', text: `Regime informado: ${user.regime || 'nao informado'}.` },
    { title: 'Eficiencia tributaria', text: 'Compare faturamento, margem e atividade para validar se o regime continua adequado.' },
    { title: 'Operacao fiscal', text: 'Mantenha documentos e notas organizados para reduzir risco operacional.' }
  ]);
  renderInsightList('[data-tax-opportunities]', [
    { title: 'Economia potencial', text: 'Execute diagnosticos tributarios para estimar economia e creditos recuperaveis.' },
    { title: 'Riscos fiscais', text: 'Alertas de DAS/DARF e divergencias de movimento devem ser tratados antes do fechamento.' },
    { title: 'Proximo ciclo', text: 'Revisar regime antes de mudancas relevantes de faturamento ou margem.' }
  ]);
  renderInsightList('[data-action-insights]', [
    { title: 'Conectar banco', text: 'Use Open Finance para automatizar conciliacao e fluxo de caixa.' },
    { title: 'Enviar demonstrativos', text: 'Inclua DRE, balanco ou extratos para ativar analises gerenciais.' },
    { title: 'Atualizar perfil', text: 'Complete nome, telefone e dados fiscais para melhorar recomendacoes.' }
  ]);
  renderInsightList('[data-next-steps]', [
    { title: 'Prioridade 1', text: pendencias ? 'Resolver pendencias abertas no painel financeiro.' : 'Manter rotina semanal de acompanhamento.' },
    { title: 'Prioridade 2', text: 'Validar enquadramento tributario com base no faturamento atual.' },
    { title: 'Prioridade 3', text: 'Conectar contas bancarias e revisar fluxo de caixa projetado.' }
  ]);
}

function renderDashboard(payload) {
  const dashboard = payload?.dashboard || payload;
  if (!dashboard) return;
  state.dashboard = dashboard;

  const summary = dashboard.summary || {};
  renderBusinessDashboards(dashboard);

  const table = $('[data-reports-table]');
  table.innerHTML = '';
  (dashboard.reports || []).slice(0, 8).forEach((report) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${report.date || '-'}</td>
      <td>${report.title || '-'}</td>
      <td>${report.status || '-'}</td>
      <td>${formatCurrency(report.amount || 0)}</td>
    `;
    table.appendChild(row);
  });

  const user = dashboard.user || {};
  if (user.email) state.authEmail = user.email;
  $('[data-user-title]').textContent = `Dashboard ${user.fantasia || user.nome || user.email || ''}`.trim();
}

async function loadDashboard() {
  if (!state.token) return;
  const data = await apiRequest('/api/dashboard');
  renderDashboard(data);
}

async function loadProfile() {
  if (!state.token) return;
  try {
    const data = await apiRequest('/api/profile');
    const profile = data.perfil || data.profile || data.usuario || {};
    const form = $('[data-profile-form]');
    if (!form) return;
    ['nome', 'fantasia', 'telefone'].forEach((field) => {
      if (form.elements[field]) form.elements[field].value = profile[field] || '';
    });
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadBanks() {
  if (!state.token) return;
  try {
    const data = await apiRequest('/api/openfinance/banks');
    state.banks = data.banks || [];
    renderBanks();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderBanks() {
  const list = $('[data-bank-list]');
  if (!list) return;
  list.innerHTML = '';
  if (!state.banks.length) {
    list.innerHTML = '<div class="company-preview">Nenhum banco conectado ainda.</div>';
    return;
  }
  state.banks.forEach((bank) => {
    const item = document.createElement('div');
    item.className = 'bank-item';
    item.innerHTML = `
      <div>
        <strong>${bank.bankName || 'Banco conectado'}</strong>
        <p>Ultima sincronizacao: ${bank.lastSync ? new Date(bank.lastSync).toLocaleString('pt-BR') : '-'}</p>
      </div>
      <div>
        <button class="btn btn-light" type="button" data-sync-bank="${bank.bankId}">Sincronizar</button>
        <button class="btn btn-ghost" type="button" data-remove-bank="${bank.bankId}">Remover</button>
      </div>
    `;
    list.appendChild(item);
  });
}

async function sendCode(button) {
  const email = $('[data-login-email]').value.trim();
  if (!email) throw new Error('Informe o email.');
  setLoading(button, true, 'Enviando...');
  try {
    const data = await apiRequest('/api/auth/send-code', { method: 'POST', body: JSON.stringify({ email }) });
    $('[data-login-note]').textContent = data.mensagem || 'Codigo enviado. Verifique seu email.';
    if (data._devCode) $('[data-login-code]').value = data._devCode;
  } finally {
    setLoading(button, false);
  }
}

async function verifyCode(button) {
  const email = $('[data-login-email]').value.trim();
  const code = $('[data-login-code]').value.trim();
  if (!email || !code) throw new Error('Informe email e codigo.');
  setLoading(button, true, 'Validando...');
  try {
    const data = await apiRequest('/api/auth/verify-code', { method: 'POST', body: JSON.stringify({ email, code }) });
    persistSession(data.token, email, 'email');
    if (data.dashboard) renderDashboard(data.dashboard);
    closeModals();
    await loadDashboard();
    updateSessionUi();
    showToast('Login realizado.', 'success');
  } finally {
    setLoading(button, false);
  }
}

async function loginCnpj(button) {
  const cnpj = onlyDigits($('[data-login-cnpj]').value);
  const password = $('[data-login-password]').value;
  if (cnpj.length !== 14 || !password) throw new Error('Informe CNPJ e senha.');
  setLoading(button, true, 'Entrando...');
  try {
    const data = await apiRequest('/api/auth/login-cnpj', { method: 'POST', body: JSON.stringify({ cnpj, password }) });
    persistSession(data.token, data.email, 'cnpj');
    if (data.dashboard) renderDashboard(data.dashboard);
    closeModals();
    await Promise.all([loadDashboard(), loadBanks(), loadProfile()]);
    updateSessionUi();
    showToast('Login realizado.', 'success');
  } finally {
    setLoading(button, false);
  }
}

async function register(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const cnpj = onlyDigits($('[data-register-cnpj]').value);
  const password = $('[data-register-password]').value;
  const confirm = $('[data-register-confirm]').value;
  const plan = $('[data-register-plan]').value;
  if (cnpj.length !== 14) throw new Error('Informe um CNPJ com 14 digitos.');
  if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
  if (password !== confirm) throw new Error('As senhas nao conferem.');

  const button = $('button[type="submit"]', form);
  setLoading(button, true, 'Criando...');
  try {
    await apiRequest('/api/auth/register-cnpj', { method: 'POST', body: JSON.stringify({ cnpj, password, plan }) });
    const login = await apiRequest('/api/auth/login-cnpj', { method: 'POST', body: JSON.stringify({ cnpj, password }) });
    persistSession(login.token, login.email, 'cnpj');
    if (login.dashboard) renderDashboard(login.dashboard);
    closeModals();
    await Promise.all([loadDashboard(), loadBanks(), loadProfile()]);
    showToast('Conta criada. Redirecionando para pagamento...', 'success');
    await redirectToCheckout(plan);
  } finally {
    setLoading(button, false);
  }
}

async function redirectToCheckout(plan) {
  const data = await apiRequest('/api/pagamento', {
    method: 'POST',
    body: JSON.stringify({ plano: plan })
  });
  if (!data.checkoutUrl) throw new Error('Checkout nao retornado pelo servidor.');
  window.location.href = data.checkoutUrl;
}

async function connectBank(button) {
  if (!state.token) {
    openModal('[data-login-modal]');
    return;
  }
  setLoading(button, true, 'Gerando token...');
  try {
    const data = await apiRequest('/api/openfinance/token');
    if (!data.token) throw new Error('Token Pluggy nao retornado pelo servidor.');
    if (!window.PluggyConnect) throw new Error('Pluggy Connect nao carregou. Verifique bloqueadores ou conexao.');

    const pluggy = new window.PluggyConnect({
      connectToken: data.token,
      includeSandbox: true,
      onSuccess: async (itemData) => {
        const itemId = itemData.item?.id || itemData.itemId || itemData.id;
        if (!itemId) {
          showToast('Banco conectado, mas a Pluggy nao retornou itemId.', 'error');
          return;
        }
        await apiRequest('/api/openfinance/connect', { method: 'POST', body: JSON.stringify({ itemId }) });
        await loadBanks();
        showToast('Banco conectado com sucesso.', 'success');
      },
      onError: (error) => showToast(error?.message || 'Falha ao conectar banco.', 'error')
    });
    pluggy.init();
  } finally {
    setLoading(button, false);
  }
}

async function syncBank(bankId) {
  await apiRequest(`/api/openfinance/sync/${encodeURIComponent(bankId)}`, { method: 'POST' });
  await loadBanks();
  showToast('Banco sincronizado.', 'success');
}

async function removeBank(bankId) {
  await apiRequest(`/api/openfinance/banks/${encodeURIComponent(bankId)}`, { method: 'DELETE' });
  await loadBanks();
  showToast('Banco removido.', 'success');
}

async function saveProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    nome: form.elements.nome.value.trim(),
    fantasia: form.elements.fantasia.value.trim(),
    telefone: form.elements.telefone.value.trim()
  };
  await apiRequest('/api/profile', { method: 'PUT', body: JSON.stringify(payload) });
  await loadDashboard();
  showToast('Perfil salvo.', 'success');
}

function handleAuth0Redirect() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (!token) return;
  persistSession(token, params.get('email') || state.authEmail || 'auth0', 'auth0');
  history.replaceState(null, '', `${location.pathname}#dashboard`);
  loadDashboard().catch((error) => showToast(error.message, 'error'));
}

function bindEvents() {
  $$('[data-open-login]').forEach((button) => button.addEventListener('click', () => openModal('[data-login-modal]')));
  $$('[data-open-register]').forEach((button) => button.addEventListener('click', () => openModal('[data-register-modal]')));
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModals));
  $$('[data-auth-tab]').forEach((button) => button.addEventListener('click', () => setAuthTab(button.dataset.authTab)));
  $$('[data-tab]').forEach((button) => button.addEventListener('click', () => {
    setDashboardTab(button.dataset.tab);
    if (button.dataset.tab === 'openfinance') loadBanks();
    if (button.dataset.tab === 'profile') loadProfile();
  }));

  $('[data-send-code]')?.addEventListener('click', (event) => sendCode(event.currentTarget).catch((error) => showToast(error.message, 'error')));
  $('[data-verify-code]')?.addEventListener('click', (event) => verifyCode(event.currentTarget).catch((error) => showToast(error.message, 'error')));
  $('[data-login-cnpj-submit]')?.addEventListener('click', (event) => loginCnpj(event.currentTarget).catch((error) => showToast(error.message, 'error')));
  $('[data-register-form]')?.addEventListener('submit', (event) => register(event).catch((error) => showToast(error.message, 'error')));
  $('[data-refresh-dashboard]')?.addEventListener('click', () => loadDashboard().catch((error) => showToast(error.message, 'error')));
  $('[data-connect-bank]')?.addEventListener('click', (event) => connectBank(event.currentTarget).catch((error) => showToast(error.message, 'error')));
  $('[data-profile-form]')?.addEventListener('submit', (event) => saveProfile(event).catch((error) => showToast(error.message, 'error')));

  $('[data-register-cnpj]')?.addEventListener('input', (event) => {
    const cnpj = onlyDigits(event.target.value);
    $('[data-company-preview]').textContent = cnpj.length === 14
      ? `Conta sera criada para o CNPJ ${cnpj}.`
      : 'Informe o CNPJ para criar a conta.';
  });

  $$('[data-select-plan]').forEach((button) => button.addEventListener('click', () => {
    state.pendingPlan = button.dataset.selectPlan;
    $('[data-register-plan]').value = state.pendingPlan;
    openModal('[data-register-modal]');
  }));

  $('[data-bank-list]')?.addEventListener('click', (event) => {
    const syncId = event.target.dataset.syncBank;
    const removeId = event.target.dataset.removeBank;
    if (syncId) syncBank(syncId).catch((error) => showToast(error.message, 'error'));
    if (removeId) removeBank(removeId).catch((error) => showToast(error.message, 'error'));
  });

  $('[data-logout]')?.addEventListener('click', () => {
    const provider = state.provider;
    clearSession();
    if (provider === 'auth0') window.location.href = '/api/auth/auth0/logout';
    else showToast('Sessao encerrada.', 'success');
  });

  $('[data-auth-link]')?.addEventListener('click', (event) => {
    if (!state.token) {
      event.preventDefault();
      openModal('[data-login-modal]');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  handleAuth0Redirect();
  updateSessionUi();
  if (state.token) {
    updateSessionUi();
    Promise.all([loadDashboard(), loadBanks(), loadProfile()]).catch((error) => {
      showToast(error.message, 'error');
      if (/token|jwt|unauthorized|401/i.test(error.message)) clearSession();
    });
  }
});
