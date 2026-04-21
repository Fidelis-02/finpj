const state = {
  token: localStorage.getItem('finpj_token') || '',
  authEmail: localStorage.getItem('finpj_email') || '',
  provider: localStorage.getItem('finpj_provider') || 'local',
  pendingPlan: 'growth',
  dashboard: null,
  profile: null,
  banks: [],
  cnpjData: null,
  cnpjTimer: null,
  analyses: [],
  diagnostics: [],
  fiscalEvents: []
};

const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function formatPercent(value, digits = 2) {
  const numeric = Number(value) || 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(numeric);
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCnpj(value) {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function parseMoneyLike(value) {
  const normalized = String(value || '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return Number(normalized) || 0;
}

function parsePercentLike(value, fallback = NaN) {
  const parsed = Number(String(value || '').replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed > 1 ? parsed / 100 : parsed;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('pt-BR');
}

function formatRegime(value) {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('simples')) return 'Simples Nacional';
  if (raw.includes('presumido')) return 'Lucro Presumido';
  if (raw.includes('real')) return 'Lucro Real';
  return value || 'A definir';
}

function inferActivity(setor = '') {
  const normalized = String(setor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/comerc|varejo|atacad/.test(normalized)) return 'comercio';
  if (/industr|fabric|manuf/.test(normalized)) return 'industria';
  if (/servic|consult|clin|agenc|software|profission/.test(normalized)) return 'servicos';
  return 'comercio';
}

function calculateTaxSimulation({ faturamento, margem, atividade }) {
  if (!window.FinPJTax?.simulateTaxes) {
    throw new Error('Motor tributario indisponivel. Recarregue a pagina.');
  }
  return window.FinPJTax.simulateTaxes({
    annualRevenue: faturamento,
    margin: margem,
    activity: atividade
  });
}

function calculatePublicRegime(params) {
  return calculateTaxSimulation(params).regimes;
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
  state.profile = null;
  state.banks = [];
  state.analyses = [];
  state.diagnostics = [];
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

  if (tab === 'openfinance') loadBanks().catch((error) => showToast(error.message, 'error'));
  if (tab === 'profile') loadProfile().catch((error) => showToast(error.message, 'error'));
  if (tab === 'ai') loadAnalyses().catch((error) => showToast(error.message, 'error'));
  if (tab === 'diagnostics') loadDiagnostics().catch((error) => showToast(error.message, 'error'));
  if (tab === 'tax') loadFiscalCalendar().catch((error) => showToast(error.message, 'error'));
  if (tab === 'financial') renderFinancialDeepDive();
}

function goToDashboardTab(tab) {
  if (!state.token) {
    openModal('[data-login-modal]');
    return;
  }
  setDashboardTab(tab);
  location.hash = '#dashboard';
  $('[data-dashboard]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTaxRows(selector, regimes) {
  const target = $(selector);
  if (!target) return;
  target.innerHTML = '';
  regimes.forEach((regime, index) => {
    const row = document.createElement('div');
    row.className = `regime-row ${index === 0 ? 'is-best' : ''}`;
    if (regime.eligible === false) {
      row.classList.remove('is-best');
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(regime.name)}</strong>
          <small>${escapeHtml(regime.reason || 'Regime nao aplicavel aos dados informados.')}</small>
        </div>
        <span>-</span>
      `;
      target.appendChild(row);
      return;
    }
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(regime.name)}</strong>
        <small>${index === 0 ? 'Melhor estimativa' : `Alíquota efetiva ${formatPercent(regime.effectiveRate)}`}</small>
      </div>
      <span>${formatCurrency(regime.monthly)}/mês</span>
    `;
    if (regime.eligible !== false) {
      const detail = document.createElement('small');
      detail.className = 'regime-row-detail';
      const annualTax = regime.annualTax ?? regime.tax;
      const monthlyTax = regime.monthlyTax ?? regime.monthly;
      const savings = regime.savingsComparedToWorst?.annual || 0;
      detail.textContent = `Anual ${formatCurrency(annualTax)} | mensal ${formatCurrency(monthlyTax)} | aliquota efetiva ${formatPercent(regime.effectiveRate)}${savings ? ` | economia vs pior ${formatCurrency(savings)}` : ''}`;
      $('div', row)?.appendChild(detail);
    }
    target.appendChild(row);
  });
}

function renderPublicDiagnostic(regimes, annualRevenue) {
  const best = regimes[0];
  const worst = regimes[regimes.length - 1];
  const economy = Math.max(0, worst.tax - best.tax);
  $('[data-public-best-regime]').textContent = best.name;
  $('[data-public-diagnostic-copy]').textContent = annualRevenue
    ? `Estimativa anual de impostos: ${formatCurrency(best.tax)}. Economia potencial frente ao pior cenário: ${formatCurrency(economy)}.`
    : 'Preencha os dados para visualizar uma comparação tributária prévia.';
  renderTaxRows('[data-regime-comparison]', regimes);
}

function runPublicDiagnostic(event) {
  event?.preventDefault();
  const form = $('[data-public-diagnostic-form]');
  if (!form) return;
  const faturamento = parseMoneyLike(form.elements.faturamento.value);
  const margem = parsePercentLike(form.elements.margem.value);
  const atividade = form.elements.atividade.value;
  try {
    const regimes = calculatePublicRegime({ faturamento, margem, atividade });
    renderPublicDiagnostic(regimes, faturamento);
  } catch (error) {
    $('[data-public-best-regime]').textContent = 'Dados invalidos';
    $('[data-public-diagnostic-copy]').textContent = error.message;
    renderTaxRows('[data-regime-comparison]', []);
  }
}

function getCurrentUser() {
  return {
    ...(state.dashboard?.user || {}),
    ...(state.profile || {})
  };
}

function getBankTransactions() {
  return state.banks.flatMap((bank) => (bank.transactions || []).map((transaction) => ({
    ...transaction,
    bankName: bank.bankName || 'Banco'
  })));
}

function buildMetrics(dashboard = state.dashboard || {}) {
  const user = getCurrentUser();
  const reports = dashboard.reports || [];
  const summary = dashboard.summary || {};
  const transactions = getBankTransactions();
  const monthlyIncome = transactions
    .filter((item) => Number(item.valor) > 0 || item.tipo === 'entrada')
    .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0);
  const monthlyExpenses = transactions
    .filter((item) => Number(item.valor) < 0 || item.tipo === 'saida')
    .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0);

  const totalMovimentado = Number(summary.totalMovimentado || 0);
  const annualRevenue = Number(user.faturamento || user.faturamentoAnual || 0)
    || (monthlyIncome ? Math.round(monthlyIncome * 12) : Math.round(totalMovimentado));
  const informedMargin = Number(user.margem || user.margemEstimada || 0);
  const margin = informedMargin > 1 ? informedMargin / 100 : informedMargin || 0;
  const profit = Math.round(annualRevenue * margin);
  const expenses = Math.max(0, annualRevenue - profit);
  const activity = inferActivity(user.setor);
  let regimes = [];
  let bestRegime = { name: 'Nao calculado', tax: 0, annualTax: 0, monthly: 0, monthlyTax: 0, effectiveRate: 0 };
  try {
    regimes = annualRevenue && margin > 0
      ? calculatePublicRegime({ faturamento: annualRevenue, margem: margin, atividade: activity })
      : [];
    bestRegime = regimes[0] || bestRegime;
  } catch {
    regimes = [];
  }
  const currentRegime = formatRegime(user.regime || '');
  const currentRegimeItem = regimes.find((regime) => regime.name === currentRegime);
  const taxGap = regimes.length
    ? (currentRegimeItem ? Math.max(0, currentRegimeItem.tax - bestRegime.tax) : Math.max(0, regimes[regimes.length - 1].tax - bestRegime.tax))
    : 0;

  return {
    user,
    reports,
    transactions,
    annualRevenue,
    margin,
    profit,
    expenses,
    monthlyIncome,
    monthlyExpenses,
    monthlyBalance: monthlyIncome - monthlyExpenses,
    pendencias: Number(summary.pendencias || 0),
    activity,
    regimes,
    bestRegime,
    currentRegime,
    taxGap
  };
}

function renderInsightList(selector, items) {
  const target = $(selector);
  if (!target) return;
  target.innerHTML = '';

  items.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'insight-item';

    const title = document.createElement('strong');
    title.textContent = item.title;
    el.appendChild(title);

    const text = document.createElement('p');
    text.textContent = item.text;
    el.appendChild(text);

    if (item.actionLabel && item.actionTab) {
      const button = document.createElement('button');
      button.className = 'btn btn-light btn-sm';
      button.type = 'button';
      button.dataset.goTab = item.actionTab;
      button.textContent = item.actionLabel;
      el.appendChild(button);
    }

    target.appendChild(el);
  });
}

function renderActionCards(selector, actions) {
  const target = $(selector);
  if (!target) return;
  target.innerHTML = '';
  actions.forEach((action) => {
    const card = document.createElement('button');
    card.className = `action-card ${action.tone ? `is-${action.tone}` : ''}`;
    card.type = 'button';
    card.dataset.goTab = action.tab;
    card.innerHTML = `
      <span>${escapeHtml(action.label)}</span>
      <strong>${escapeHtml(action.title)}</strong>
      <small>${escapeHtml(action.text)}</small>
    `;
    target.appendChild(card);
  });
}

function getReadinessItems(metrics) {
  const user = metrics.user;
  return [
    {
      title: 'Cadastro empresarial',
      text: user.cnpj && (user.nome || user.fantasia) ? 'CNPJ e razão social preenchidos.' : 'Completar CNPJ, razão social e contato.',
      done: Boolean(user.cnpj && (user.nome || user.fantasia)),
      tab: 'profile'
    },
    {
      title: 'Perfil financeiro',
      text: user.faturamento && user.margem && user.regime ? 'Faturamento, margem e regime informados.' : 'Informar faturamento, margem e regime atual.',
      done: Boolean(user.faturamento && user.margem && user.regime),
      tab: 'profile'
    },
    {
      title: 'Open Finance',
      text: state.banks.length ? `${state.banks.length} banco(s) conectado(s).` : 'Conectar pelo menos uma conta PJ.',
      done: state.banks.length > 0,
      tab: 'openfinance'
    },
    {
      title: 'DRE ou balanço',
      text: state.analyses.length ? `${state.analyses.length} análise(s) registrada(s).` : 'Enviar DRE, balanço ou extrato.',
      done: state.analyses.length > 0,
      tab: 'ai'
    },
    {
      title: 'Diagnóstico fiscal',
      text: state.diagnostics.length ? `${state.diagnostics.length} diagnóstico(s) salvo(s).` : 'Rodar o simulador fiscal completo.',
      done: state.diagnostics.length > 0,
      tab: 'diagnostics'
    }
  ];
}

function renderSetupProgress(metrics) {
  const items = getReadinessItems(metrics);
  const done = items.filter((item) => item.done).length;
  const score = Math.round((done / items.length) * 100);
  const scoreEl = $('[data-readiness-score]');
  if (scoreEl) scoreEl.textContent = `${score}%`;

  const target = $('[data-setup-steps]');
  if (!target) return;
  target.innerHTML = '';
  items.forEach((item) => {
    const step = document.createElement('button');
    step.className = `setup-step ${item.done ? 'is-done' : ''}`;
    step.type = 'button';
    step.dataset.goTab = item.tab;
    step.innerHTML = `
      <span class="status-pill">${item.done ? 'OK' : 'Pendente'}</span>
      <strong>${escapeHtml(item.title)}</strong>
      <small>${escapeHtml(item.text)}</small>
    `;
    target.appendChild(step);
  });
}

function buildRecommendedActions(metrics) {
  const actions = [];
  const user = metrics.user;
  if (!user.faturamento || !user.margem || !user.regime) {
    actions.push({
      label: 'Perfil',
      title: 'Completar dados financeiros',
      text: 'Faturamento, margem e regime liberam simulações mais úteis.',
      tab: 'profile',
      tone: 'warning'
    });
  }
  if (!state.banks.length) {
    actions.push({
      label: 'Open Finance',
      title: 'Conectar conta PJ',
      text: 'Importa transações para fluxo de caixa e alertas de custo.',
      tab: 'openfinance'
    });
  }
  if (!state.analyses.length) {
    actions.push({
      label: 'Documentos',
      title: 'Enviar DRE ou balanço',
      text: 'Ativa leitura de margem, EBITDA e pontos críticos.',
      tab: 'ai'
    });
  }
  if (!state.diagnostics.length) {
    actions.push({
      label: 'Fiscal',
      title: 'Gerar diagnóstico tributário',
      text: 'Compara regimes e estima economia anual.',
      tab: 'diagnostics',
      tone: 'success'
    });
  }
  actions.push({
    label: 'Tributos',
    title: `Simular ${metrics.bestRegime?.name || 'regime ideal'}`,
    text: metrics.taxGap ? `Economia potencial: ${formatCurrency(metrics.taxGap)} ao ano.` : 'Comparação disponível no painel tributário.',
    tab: 'tax'
  });
  return actions.slice(0, 5);
}

function renderDecisionCenter(metrics) {
  const actions = buildRecommendedActions(metrics);
  const title = $('[data-decision-title]');
  const summary = $('[data-decision-summary]');
  if (title) title.textContent = actions[0]?.title || 'Acompanhar margem e impostos';
  if (summary) {
    summary.textContent = metrics.annualRevenue
      ? `Receita anual base de ${formatCurrency(metrics.annualRevenue)}, margem estimada de ${formatPercent(metrics.margin)} e melhor regime estimado: ${metrics.bestRegime.name}.`
      : 'Complete o perfil financeiro para transformar o dashboard em uma rotina de controladoria.';
  }
  renderActionCards('[data-decision-actions]', actions.slice(0, 3));
  renderActionCards('[data-action-board]', actions);
}

function renderSummaryRows(selector, rows) {
  const target = $(selector);
  if (!target) return;
  target.innerHTML = '';
  rows.forEach((row) => {
    const item = document.createElement('div');
    item.className = 'summary-row';
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(row.label)}</strong>
        <small>${escapeHtml(row.note || '')}</small>
      </div>
      <span>${escapeHtml(row.value)}</span>
    `;
    target.appendChild(item);
  });
}

function renderReportsTable(reports = []) {
  const table = $('[data-reports-table]');
  if (!table) return;
  table.innerHTML = '';
  if (!reports.length) {
    table.innerHTML = '<tr><td colspan="4">Nenhum movimento gerencial disponível.</td></tr>';
    return;
  }
  reports.slice(0, 8).forEach((report) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(formatDate(report.date))}</td>
      <td>${escapeHtml(report.title || '-')}</td>
      <td>${escapeHtml(report.status || '-')}</td>
      <td>${escapeHtml(formatCurrency(report.amount || 0))}</td>
    `;
    table.appendChild(row);
  });
}

function renderTransactionsTable(transactions = []) {
  const table = $('[data-transactions-table]');
  if (!table) return;
  table.innerHTML = '';
  if (!transactions.length) {
    table.innerHTML = '<tr><td colspan="4">Conecte um banco para listar transações reais.</td></tr>';
    return;
  }
  transactions
    .slice()
    .sort((a, b) => new Date(b.data || b.date || 0) - new Date(a.data || a.date || 0))
    .slice(0, 10)
    .forEach((transaction) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${escapeHtml(formatDate(transaction.data || transaction.date))}</td>
        <td>${escapeHtml(transaction.descricao || transaction.description || '-')}</td>
        <td>${escapeHtml(transaction.categoria || transaction.category || 'Outros')}</td>
        <td>${escapeHtml(formatCurrency(transaction.valor || transaction.amount || 0))}</td>
      `;
      table.appendChild(row);
    });
}

function renderFinancialDeepDive(metrics = buildMetrics()) {
  renderSummaryRows('[data-cashflow-summary]', [
    { label: 'Entradas importadas', value: formatCurrency(metrics.monthlyIncome), note: state.banks.length ? 'Base Open Finance' : 'Aguardando conexão' },
    { label: 'Saídas importadas', value: formatCurrency(metrics.monthlyExpenses), note: state.banks.length ? 'Última sincronização bancária' : 'Aguardando conexão' },
    { label: 'Saldo mensal estimado', value: formatCurrency(metrics.monthlyBalance), note: metrics.monthlyBalance >= 0 ? 'Fluxo positivo' : 'Revisar despesas' },
    { label: 'Lucro anual estimado', value: formatCurrency(metrics.profit), note: `Margem ${formatPercent(metrics.margin)}` }
  ]);

  const byCategory = new Map();
  metrics.transactions.forEach((transaction) => {
    const category = transaction.categoria || transaction.category || 'Outros';
    const value = Math.abs(Number(transaction.valor || transaction.amount || 0));
    if (Number(transaction.valor || transaction.amount || 0) < 0 || transaction.tipo === 'saida') {
      byCategory.set(category, (byCategory.get(category) || 0) + value);
    }
  });
  const categoryRows = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, value]) => ({ label, value: formatCurrency(value), note: 'Saídas no período' }));
  renderSummaryRows('[data-category-summary]', categoryRows.length ? categoryRows : [
    { label: 'Sem categorias importadas', value: '0', note: 'Conecte banco ou envie extrato' }
  ]);

  renderTransactionsTable(metrics.transactions);
  renderOpenFinanceSummary(metrics);
}

function syncDashboardForms(user) {
  const taxForm = $('[data-dashboard-tax-form]');
  if (taxForm) {
    if (taxForm.elements.faturamento && !taxForm.elements.faturamento.value) taxForm.elements.faturamento.value = user.faturamento || user.faturamentoAnual || '';
    if (taxForm.elements.margem && !taxForm.elements.margem.value) taxForm.elements.margem.value = user.margem || user.margemEstimada || '';
    if (taxForm.elements.regime && !taxForm.elements.regime.value) taxForm.elements.regime.value = user.regime || '';
    if (taxForm.elements.atividade && user.setor) taxForm.elements.atividade.value = inferActivity(user.setor);
  }

  const diagForm = $('[data-diagnostic-form]');
  if (diagForm) {
    if (diagForm.elements.nome && !diagForm.elements.nome.value) diagForm.elements.nome.value = user.nome || user.fantasia || user.nomeEmpresa || '';
    if (diagForm.elements.cnpj && !diagForm.elements.cnpj.value) diagForm.elements.cnpj.value = formatCnpj(user.cnpj || '');
    if (diagForm.elements.setor && !diagForm.elements.setor.value) diagForm.elements.setor.value = user.setor || '';
    if (diagForm.elements.regime && !diagForm.elements.regime.value) diagForm.elements.regime.value = user.regime || 'simples';
    if (diagForm.elements.faturamento && !diagForm.elements.faturamento.value) diagForm.elements.faturamento.value = user.faturamento || user.faturamentoAnual || '';
    if (diagForm.elements.margem && !diagForm.elements.margem.value) diagForm.elements.margem.value = user.margem || user.margemEstimada || '';
  }
}

function runDashboardTaxSimulation(event) {
  event?.preventDefault();
  const form = $('[data-dashboard-tax-form]');
  const summary = $('[data-dashboard-tax-summary]');
  if (!form) return;

  const faturamento = parseMoneyLike(form.elements.faturamento.value);
  if (!faturamento) {
    $('[data-dashboard-tax-comparison]').innerHTML = '';
    if (summary) summary.textContent = 'Informe faturamento e margem para comparar.';
    return;
  }

  const margem = parsePercentLike(form.elements.margem.value);
  const atividade = form.elements.atividade.value || inferActivity(getCurrentUser().setor);
  if (!Number.isFinite(margem) || margem < 0) {
    $('[data-dashboard-tax-comparison]').innerHTML = '';
    if (summary) summary.textContent = 'Informe uma margem entre 0% e 100%.';
    return;
  }
  if (atividade !== 'comercio') {
    $('[data-dashboard-tax-comparison]').innerHTML = '';
    if (summary) summary.textContent = 'O comparador atual usa regras de comercio. Selecione comercio para simular.';
    return;
  }
  const currentRegime = formatRegime(form.elements.regime.value || getCurrentUser().regime || '');
  const regimes = calculatePublicRegime({ faturamento, margem, atividade });
  const best = regimes[0];
  const current = regimes.find((regime) => regime.name === currentRegime);
  const economy = current ? Math.max(0, current.tax - best.tax) : Math.max(0, regimes[regimes.length - 1].tax - best.tax);

  renderTaxRows('[data-dashboard-tax-comparison]', regimes);
  if (summary) {
    summary.textContent = `${best.name} aparece como melhor opção estimada. Imposto anual: ${formatCurrency(best.tax)}. Economia potencial: ${formatCurrency(economy)}.`;
  }
}

function copyTaxToDiagnostic() {
  const taxForm = $('[data-dashboard-tax-form]');
  const diagForm = $('[data-diagnostic-form]');
  if (!taxForm || !diagForm) return;
  const user = getCurrentUser();
  diagForm.elements.nome.value = diagForm.elements.nome.value || user.nome || user.fantasia || user.nomeEmpresa || '';
  diagForm.elements.cnpj.value = diagForm.elements.cnpj.value || formatCnpj(user.cnpj || '');
  diagForm.elements.setor.value = diagForm.elements.setor.value || user.setor || taxForm.elements.atividade.value || '';
  diagForm.elements.regime.value = taxForm.elements.regime.value || user.regime || 'simples';
  diagForm.elements.faturamento.value = taxForm.elements.faturamento.value;
  diagForm.elements.margem.value = taxForm.elements.margem.value;
  goToDashboardTab('diagnostics');
  showToast('Dados enviados para o diagnóstico fiscal.', 'success');
}

function renderTaxCalendar() {
  const events = state.fiscalEvents
    .filter((event) => !event.passado)
    .sort((a, b) => new Date(a.data) - new Date(b.data))
    .slice(0, 5)
    .map((event) => ({
      title: event.titulo,
      text: `${formatDate(event.data)} - ${event.desc || event.tipo || 'Obrigação fiscal'}`
    }));
  renderInsightList('[data-tax-calendar]', events.length ? events : [
    { title: 'Calendário indisponível', text: 'Atualize o painel para carregar os próximos vencimentos.' }
  ]);
}

function renderBusinessDashboards(dashboard = state.dashboard) {
  if (!dashboard) return;
  const metrics = buildMetrics(dashboard);
  const user = metrics.user;

  $('[data-exec="revenue"]').textContent = formatCurrency(metrics.annualRevenue);
  $('[data-exec="margin"]').textContent = formatPercent(metrics.margin);
  $('[data-exec="regime"]').textContent = formatRegime(user.regime || '');
  $('[data-financial="income"]').textContent = formatCurrency(metrics.annualRevenue);
  $('[data-financial="expenses"]').textContent = formatCurrency(metrics.expenses);
  $('[data-financial="profit"]').textContent = formatCurrency(metrics.profit);

  syncDashboardForms(user);
  renderDecisionCenter(metrics);
  renderSetupProgress(metrics);
  renderReportsTable(metrics.reports);
  renderFinancialDeepDive(metrics);
  runDashboardTaxSimulation();
  renderTaxCalendar();

  renderInsightList('[data-executive-summary]', [
    { title: 'Saúde financeira', text: metrics.annualRevenue ? `Margem estimada de ${formatPercent(metrics.margin)} sobre ${formatCurrency(metrics.annualRevenue)} de receita anual.` : 'Complete o perfil para calcular margem, lucro e tributos.' },
    { title: 'Regime fiscal estimado', text: `${metrics.bestRegime.name} é o melhor cenário calculado para os dados atuais.`, actionLabel: 'Comparar regimes', actionTab: 'tax' },
    { title: 'Plano ativo', text: `Plano ${user.plano || 'starter'} com pagamento ${user.statusPagamento || 'pendente'}.` }
  ]);
  renderInsightList('[data-main-alerts]', [
    { title: 'Pendências operacionais', text: `${metrics.pendencias} item(ns) exigem revisão no resumo financeiro.`, actionLabel: 'Ver finanças', actionTab: 'financial' },
    { title: 'Dados bancários', text: state.banks.length ? `${state.banks.length} banco(s) conectado(s) ao Open Finance.` : 'Nenhum banco conectado para conciliação automática.', actionLabel: 'Conectar banco', actionTab: 'openfinance' },
    { title: 'Economia tributária', text: metrics.taxGap ? `Há até ${formatCurrency(metrics.taxGap)} de diferença anual entre cenários.` : 'Nenhuma diferença relevante estimada com os dados atuais.', actionLabel: 'Gerar diagnóstico', actionTab: 'diagnostics' }
  ]);
  renderInsightList('[data-balance-reading]', [
    { title: 'DRE gerencial', text: state.analyses.length ? `${state.analyses.length} documento(s) analisado(s) pela IA.` : 'Envie DRE ou balanço para calcular indicadores gerenciais.', actionLabel: 'Enviar documento', actionTab: 'ai' },
    { title: 'Margem de contribuição', text: metrics.margin ? `Margem base informada: ${formatPercent(metrics.margin)}.` : 'Informe margem ou envie demonstrativos para estimar contribuição.' },
    { title: 'Capital de giro', text: metrics.monthlyBalance ? `Saldo mensal importado: ${formatCurrency(metrics.monthlyBalance)}.` : 'Conecte bancos para acompanhar pressão de caixa.' }
  ]);
  renderInsightList('[data-balance-risks]', [
    { title: 'Custos atípicos', text: metrics.monthlyExpenses ? `Saídas importadas: ${formatCurrency(metrics.monthlyExpenses)} no período.` : 'Sem histórico bancário suficiente para detectar anomalias.' },
    { title: 'Qualidade dos dados', text: 'Perfil, banco e documentos formam a base para análises preditivas.' },
    { title: 'Próximo fechamento', text: 'Revise DRE, saldo e impostos antes do fechamento mensal.', actionLabel: 'Ver prioridades', actionTab: 'insights' }
  ]);
  renderInsightList('[data-tax-fit]', [
    { title: 'Regime atual', text: `Regime informado: ${formatRegime(user.regime || '')}.` },
    { title: 'Melhor cenário estimado', text: `${metrics.bestRegime.name} com imposto anual estimado em ${formatCurrency(metrics.bestRegime.tax)}.` },
    { title: 'Créditos e oportunidades', text: 'O diagnóstico fiscal aprofunda créditos, anomalias e economia por regime.', actionLabel: 'Gerar diagnóstico', actionTab: 'diagnostics' }
  ]);
  renderInsightList('[data-action-insights]', [
    { title: 'Open Finance', text: state.banks.length ? 'Sincronize bancos para manter transações atualizadas.' : 'Conecte a conta PJ para automatizar fluxo de caixa.', actionLabel: 'Abrir Open Finance', actionTab: 'openfinance' },
    { title: 'DRE e balanço', text: state.analyses.length ? 'Revise o histórico de análises e compare evolução mensal.' : 'Envie demonstrativos para ativar leitura de EBITDA e liquidez.', actionLabel: 'Abrir IA', actionTab: 'ai' },
    { title: 'Tributos', text: 'Use o comparador e salve diagnósticos para acompanhar oportunidades fiscais.', actionLabel: 'Abrir fiscal', actionTab: 'tax' }
  ]);
  renderInsightList('[data-next-steps]', buildRecommendedActions(metrics).slice(0, 3).map((action, index) => ({
    title: `Prioridade ${index + 1}`,
    text: `${action.title}. ${action.text}`,
    actionLabel: action.label,
    actionTab: action.tab
  })));
}

function renderDashboard(payload) {
  const dashboard = payload?.dashboard || payload;
  if (!dashboard) return;
  state.dashboard = dashboard;
  if (state.profile) state.dashboard.user = { ...(state.dashboard.user || {}), ...state.profile };

  const user = getCurrentUser();
  if (user.email) state.authEmail = user.email;
  $('[data-user-title]').textContent = `Dashboard ${user.fantasia || user.nome || user.email || ''}`.trim();
  renderBusinessDashboards(state.dashboard);
}

async function loadDashboard() {
  if (!state.token) return;
  const data = await apiRequest('/api/dashboard');
  renderDashboard(data);
}

async function loadProfile() {
  if (!state.token) return;
  const data = await apiRequest('/api/profile');
  const profile = data.perfil || data.profile || data.usuario || {};
  state.profile = profile;
  const form = $('[data-profile-form]');
  if (form) {
    ['nome', 'fantasia', 'telefone', 'regime', 'setor', 'faturamento', 'margem'].forEach((field) => {
      if (form.elements[field]) form.elements[field].value = profile[field] || '';
    });
    if (form.elements.cnpj) form.elements.cnpj.value = formatCnpj(profile.cnpj || '');
  }
  if (state.dashboard) renderDashboard({ ...state.dashboard, user: { ...(state.dashboard.user || {}), ...profile } });
}

function fillCompanyFields(data) {
  if (!data) return;
  state.cnpjData = data;
  const nome = data.razao_social || data.nome || data.nomeEmpresa || '';
  const fantasia = data.nome_fantasia || data.fantasia || '';
  $('[data-cnpj-result]').textContent = nome
    ? `${nome}${fantasia ? ` (${fantasia})` : ''}`
    : 'CNPJ localizado nas bases públicas.';
  $('[data-company-preview]').textContent = nome
    ? `Conta será criada para ${nome}.`
    : `Conta será criada para o CNPJ ${formatCnpj(data.cnpj || $('[data-register-cnpj]').value)}.`;
  $('[data-diag-nome]') && ($('[data-diag-nome]').value = nome || fantasia);
  $('[data-diag-cnpj]') && ($('[data-diag-cnpj]').value = formatCnpj(data.cnpj || onlyDigits($('[data-register-cnpj]').value)));
  $('[data-diag-setor]') && ($('[data-diag-setor]').value = data.cnae_fiscal_descricao || data.atividade_principal || data.setor || '');
}

async function lookupCnpj(cnpj) {
  const clean = onlyDigits(cnpj);
  if (clean.length !== 14) {
    $('[data-cnpj-result]').textContent = 'Digite o CNPJ para buscar os dados públicos da empresa.';
    return;
  }
  $('[data-cnpj-result]').textContent = 'Buscando dados públicos do CNPJ...';
  const data = await apiRequest(`/api/cnpj?cnpj=${encodeURIComponent(clean)}`);
  fillCompanyFields(data);
}

function renderAnalysisResult(targetSelector, payload) {
  const target = $(targetSelector);
  if (!target) return;
  const dados = payload?.dados || payload?.resultados || payload || {};
  const resumo = dados.resumo || payload.resumo || 'Análise concluída.';
  const alertas = dados.alertas || dados.anomalias || [];
  const recomendacoes = dados.recomendacoes || payload.recomendacoes || [];
  const fonte = payload.fonte || '-';
  const confianca = payload.confianca || {};
  const score = typeof confianca.score === 'number' ? confianca.score : null;
  const flags = confianca.flags || [];

  target.innerHTML = '';

  // Badge de fonte + confiança
  const meta = document.createElement('div');
  meta.className = 'ai-meta';
  meta.style.cssText = 'margin-bottom:8px;font-size:12px;color:#555;';
  const fonteLabel = fonte === 'groq-llama3' ? 'IA Groq' : fonte === 'local' ? 'Análise Local' : fonte;
  let confBadge = '';
  if (score !== null) {
    const cor = score >= 0.7 ? '#2e7d32' : score >= 0.4 ? '#f9a825' : '#c62828';
    const label = score >= 0.7 ? 'Alta confiança' : score >= 0.4 ? 'Confiança média' : 'Baixa confiança';
    confBadge = ` <span style="background:${cor};color:#fff;padding:1px 6px;border-radius:4px;">${label} (${(score*100).toFixed(0)}%)</span>`;
  }
  meta.innerHTML = `<span style="background:#f0f0f0;padding:2px 8px;border-radius:4px;">${escapeHtml(fonteLabel)}</span>${confBadge}`;
  if (flags.length && score < 0.7) {
    meta.innerHTML += ` <span style="color:#c62828;">⚠ ${escapeHtml(flags.join('; '))}</span>`;
  }
  target.appendChild(meta);

  const title = document.createElement('strong');
  title.textContent = resumo;
  target.appendChild(title);

  // Tabela de valores extraídos
  const tabelaChaves = [];
  if (dados.receita_bruta !== undefined || dados.lucro_bruto !== undefined) {
    tabelaChaves.push(
      ['Receita bruta', 'receita_bruta'],
      ['Receita líquida', 'receita_liquida'],
      ['Custos', 'custos'],
      ['Lucro bruto', 'lucro_bruto'],
      ['Despesas oper.', 'despesas_operacionais'],
      ['EBITDA', 'ebitda'],
      ['Lucro líquido', 'lucro_liquido'],
      ['Margem bruta', 'margem_bruta_pct'],
      ['Margem líq.', 'margem_liquida_pct']
    );
  } else if (dados.ativo_total !== undefined || dados.patrimonio_liquido !== undefined) {
    tabelaChaves.push(
      ['Ativo total', 'ativo_total'],
      ['Ativo circulante', 'ativo_circulante'],
      ['Passivo circulante', 'passivo_circulante'],
      ['Patrimônio líq.', 'patrimonio_liquido'],
      ['Liquidez corr.', 'liquidez_corrente'],
      ['Endividamento', 'endividamento_pct']
    );
  } else if (dados.saldo_final !== undefined || dados.total_entradas !== undefined) {
    tabelaChaves.push(
      ['Saldo inicial', 'saldo_inicial'],
      ['Total entradas', 'total_entradas'],
      ['Total saídas', 'total_saidas'],
      ['Saldo final', 'saldo_final'],
      ['Transações', 'num_transacoes']
    );
  }
  if (tabelaChaves.length) {
    const table = document.createElement('table');
    table.className = 'ai-values-table';
    table.style.cssText = 'width:100%;margin-top:8px;border-collapse:collapse;font-size:13px;';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th style="text-align:left;padding:4px;border-bottom:1px solid #ddd;">Indicador</th><th style="text-align:right;padding:4px;border-bottom:1px solid #ddd;">Valor</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    tabelaChaves.forEach(([label, key]) => {
      const val = dados[key];
      if (val === undefined || val === null) return;
      const tr = document.createElement('tr');
      const fmt = key.endsWith('_pct') ? formatPercent(val) : formatCurrency(val);
      tr.innerHTML = `<td style="padding:4px;border-bottom:1px solid #eee;">${escapeHtml(label)}</td><td style="text-align:right;padding:4px;border-bottom:1px solid #eee;font-weight:600;">${escapeHtml(fmt)}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    target.appendChild(table);
  }

  if (alertas.length) {
    const alertText = document.createElement('p');
    alertText.style.color = '#c62828';
    alertText.textContent = `Alertas: ${alertas.join(' | ')}`;
    target.appendChild(alertText);
  }
  if (recomendacoes.length) {
    const recText = document.createElement('p');
    recText.style.color = '#2e7d32';
    recText.textContent = `Recomendações: ${recomendacoes.join(' | ')}`;
    target.appendChild(recText);
  }
  if (Array.isArray(dados.regimes) && dados.regimes.length) {
    const list = document.createElement('div');
    list.className = 'regime-comparison';
    dados.regimes.forEach((regime) => {
      const row = document.createElement('div');
      row.className = `regime-row ${regime.name === dados.regimeIdeal ? 'is-best' : ''}`;
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(regime.name)}</strong>
          <small>Anual ${escapeHtml(formatCurrency(regime.annualTax || regime.tax || 0))} | mensal ${escapeHtml(formatCurrency(regime.monthlyTax || regime.monthly || 0))} | aliquota efetiva ${escapeHtml(formatPercent(regime.effectiveRate || 0))}</small>
        </div>
        <span>${escapeHtml(formatCurrency(regime.savingsComparedToWorst?.annual || 0))}</span>
      `;
      list.appendChild(row);
    });
    target.appendChild(list);
  }
}

function renderAnalysesList() {
  const list = $('[data-analyses-list]');
  if (!list) return;
  if (!state.analyses.length) {
    renderInsightList('[data-analyses-list]', [
      { title: 'Nenhuma análise ainda', text: 'Envie um DRE, balanço ou extrato para iniciar.' }
    ]);
    return;
  }
  list.innerHTML = '';
  state.analyses.slice(0, 8).forEach((analise) => {
    const dados = analise.resultado || {};
    const fonte = analise.fonte || '-';
    const confianca = analise.confianca || {};
    const score = typeof confianca.score === 'number' ? confianca.score : null;
    const fonteLabel = fonte === 'groq-llama3' ? 'IA' : fonte === 'local' ? 'Local' : fonte;
    let badge = '';
    if (score !== null) {
      const cor = score >= 0.7 ? '#2e7d32' : score >= 0.4 ? '#f9a825' : '#c62828';
      badge = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${cor};margin-left:6px;"></span>`;
    }
    const item = document.createElement('div');
    item.className = 'insight-item';
    item.innerHTML = `
      <strong>${escapeHtml(analise.nomeArquivo || analise.tipo || 'Análise')}</strong>
      <small style="color:#888;margin-left:6px;">${escapeHtml(fonteLabel)}${badge}</small>
      <p>${escapeHtml(dados.resumo || `Tipo: ${analise.tipo || '-'}.`)}</p>
    `;
    list.appendChild(item);
  });
}

async function loadAnalyses() {
  if (!state.token) return;
  const data = await apiRequest('/api/analises');
  state.analyses = data.analises || [];
  renderAnalysesList();
  renderBusinessDashboards();
}

function renderDiagnosticsList() {
  const list = $('[data-diagnostics-list]');
  if (!list) return;
  list.innerHTML = '';
  if (!state.diagnostics.length) {
    renderInsightList('[data-diagnostics-list]', [
      { title: 'Nenhum diagnóstico salvo', text: 'Gere uma análise fiscal para criar histórico de oportunidades.', actionLabel: 'Comparar regimes', actionTab: 'tax' }
    ]);
    return;
  }
  state.diagnostics.slice(0, 8).forEach((diagnostic) => {
    const result = diagnostic.resultados || {};
    const item = document.createElement('div');
    item.className = 'insight-item diagnostic-item';
    item.innerHTML = `
      <strong>${escapeHtml(diagnostic.nome || 'Diagnóstico fiscal')}</strong>
      <p>${escapeHtml(formatDate(diagnostic.data || diagnostic.createdAt))} - ${escapeHtml(result.regimeIdeal || 'Regime a definir')} - economia ${escapeHtml(formatCurrency(result.economia || 0))}</p>
      <div class="inline-actions">
        <button class="btn btn-light btn-sm" type="button" data-use-diagnostic="${escapeHtml(diagnostic.id)}">Reusar dados</button>
        <button class="btn btn-ghost btn-sm" type="button" data-delete-diagnostic="${escapeHtml(diagnostic.id)}">Excluir</button>
      </div>
    `;
    list.appendChild(item);
  });
}

async function loadDiagnostics() {
  if (!state.token) return;
  const data = await apiRequest('/api/diagnosticos');
  state.diagnostics = Array.isArray(data) ? data : (data.diagnosticos || []);
  renderDiagnosticsList();
  renderBusinessDashboards();
}

async function loadFiscalCalendar() {
  if (!state.token) return;
  const data = await apiRequest('/api/fiscal-calendar');
  state.fiscalEvents = data.eventos || [];
  renderTaxCalendar();
}

async function loadBanks() {
  if (!state.token) return;
  const data = await apiRequest('/api/openfinance/banks');
  state.banks = data.banks || [];
  renderBanks();
  renderBusinessDashboards();
}

function renderOpenFinanceSummary(metrics = buildMetrics()) {
  const target = $('[data-openfinance-summary]');
  if (!target) return;
  target.innerHTML = `
    <div class="metric-card"><span>Bancos conectados</span><strong>${state.banks.length}</strong><small>Open Finance</small></div>
    <div class="metric-card"><span>Entradas importadas</span><strong>${escapeHtml(formatCurrency(metrics.monthlyIncome))}</strong><small>Período atual</small></div>
    <div class="metric-card"><span>Saídas importadas</span><strong>${escapeHtml(formatCurrency(metrics.monthlyExpenses))}</strong><small>Custos e impostos</small></div>
  `;
}

function renderBanks() {
  const list = $('[data-bank-list]');
  if (!list) return;
  list.innerHTML = '';
  if (!state.banks.length) {
    list.innerHTML = '<div class="company-preview">Nenhum banco conectado ainda.</div>';
    renderOpenFinanceSummary();
    return;
  }
  state.banks.forEach((bank) => {
    const transactions = bank.transactions || [];
    const item = document.createElement('div');
    item.className = 'bank-item';
    item.innerHTML = `
      <div class="bank-meta">
        <strong>${escapeHtml(bank.bankName || 'Banco conectado')}</strong>
        <p>Última sincronização: ${escapeHtml(bank.lastSync ? new Date(bank.lastSync).toLocaleString('pt-BR') : '-')}</p>
        <small>${transactions.length} transação(ões) importada(s)</small>
      </div>
      <div class="bank-actions">
        <button class="btn btn-light" type="button" data-sync-bank="${escapeHtml(bank.bankId)}">Sincronizar</button>
        <button class="btn btn-ghost" type="button" data-remove-bank="${escapeHtml(bank.bankId)}">Remover</button>
      </div>
    `;
    list.appendChild(item);
  });
  renderOpenFinanceSummary();
}

async function sendCode(button) {
  const email = $('[data-login-email]').value.trim();
  if (!email) throw new Error('Informe o e-mail.');
  setLoading(button, true, 'Enviando...');
  try {
    const data = await apiRequest('/api/auth/send-code', { method: 'POST', body: JSON.stringify({ email }) });
    $('[data-login-note]').textContent = data.mensagem || 'Código enviado. Verifique seu e-mail.';
    if (data._devCode) $('[data-login-code]').value = data._devCode;
  } finally {
    setLoading(button, false);
  }
}

async function verifyCode(button) {
  const email = $('[data-login-email]').value.trim();
  const code = $('[data-login-code]').value.trim();
  if (!email || !code) throw new Error('Informe e-mail e código.');
  setLoading(button, true, 'Validando...');
  try {
    const data = await apiRequest('/api/auth/verify-code', { method: 'POST', body: JSON.stringify({ email, code }) });
    persistSession(data.token, email, 'email');
    if (data.dashboard) renderDashboard(data.dashboard);
    closeModals();
    await loadWorkspaceData();
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
    await loadWorkspaceData();
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
  if (cnpj.length !== 14) throw new Error('Informe um CNPJ com 14 dígitos.');
  if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
  if (password !== confirm) throw new Error('As senhas não conferem.');

  const button = $('button[type="submit"]', form);
  setLoading(button, true, 'Criando...');
  try {
    await apiRequest('/api/auth/register-cnpj', {
      method: 'POST',
      body: JSON.stringify({ cnpj, password, plan, empresa: state.cnpjData })
    });
    const login = await apiRequest('/api/auth/login-cnpj', { method: 'POST', body: JSON.stringify({ cnpj, password }) });
    persistSession(login.token, login.email, 'cnpj');
    if (login.dashboard) renderDashboard(login.dashboard);
    closeModals();
    await loadWorkspaceData();
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
  if (!data.checkoutUrl) throw new Error('Checkout indisponível no momento.');
  window.location.href = data.checkoutUrl;
}

async function connectBank(button) {
  if (!state.token) {
    openModal('[data-login-modal]');
    return;
  }
  setLoading(button, true, 'Abrindo conexão...');
  try {
    const data = await apiRequest('/api/openfinance/token');
    if (!data.token) throw new Error('Não foi possível iniciar a conexão bancária.');
    if (!window.PluggyConnect) throw new Error('Não foi possível carregar a conexão bancária. Verifique sua internet e tente novamente.');

    const pluggy = new window.PluggyConnect({
      connectToken: data.token,
      includeSandbox: true,
      onSuccess: async (itemData) => {
        const itemId = itemData.item?.id || itemData.itemId || itemData.id;
        if (!itemId) {
          showToast('Banco conectado, mas a Pluggy não retornou itemId.', 'error');
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

async function submitDiagnostic(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const faturamento = parseMoneyLike(form.elements.faturamento.value);
  const margem = parsePercentLike(form.elements.margem.value);
  if (!faturamento) throw new Error('Informe o faturamento anual.');
  if (!Number.isFinite(margem) || margem < 0) throw new Error('Informe uma margem entre 0% e 100%.');
  const payload = {
    nome: form.elements.nome.value.trim(),
    cnpj: onlyDigits(form.elements.cnpj.value),
    setor: form.elements.setor.value.trim(),
    regime: form.elements.regime.value,
    faturamento,
    margem
  };
  const button = $('button[type="submit"]', form);
  setLoading(button, true, 'Analisando...');
  try {
    const data = await apiRequest('/api/diagnosticos', { method: 'POST', body: JSON.stringify(payload) });
    renderAnalysisResult('[data-diagnostic-result]', data.resultados || data);
    await loadDiagnostics();
    showToast('Diagnóstico gerado.', 'success');
  } finally {
    setLoading(button, false);
  }
}

async function uploadAiDocument(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const file = form.elements.arquivo.files[0];
  if (!file) throw new Error('Selecione um arquivo.');
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Arquivo muito grande. Envie um arquivo de até ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(1).replace('.', ',')} MB.`);
  }
  const body = new FormData();
  body.append('tipo', form.elements.tipo.value);
  body.append('contexto', form.elements.contexto.value || '');
  body.append('arquivo', file);
  const button = $('button[type="submit"]', form);
  setLoading(button, true, 'Analisando...');
  try {
    const data = await apiRequest('/api/upload-documento', { method: 'POST', body });
    renderAnalysisResult('[data-ai-result]', data);
    await loadAnalyses();
    showToast('Análise concluída.', 'success');
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

function useDiagnostic(id) {
  const diagnostic = state.diagnostics.find((item) => String(item.id) === String(id));
  const form = $('[data-diagnostic-form]');
  if (!diagnostic || !form) return;
  form.elements.nome.value = diagnostic.nome || '';
  form.elements.cnpj.value = formatCnpj(diagnostic.cnpj || '');
  form.elements.setor.value = diagnostic.setor || '';
  form.elements.regime.value = diagnostic.regime || 'simples';
  form.elements.faturamento.value = diagnostic.faturamento || '';
  form.elements.margem.value = diagnostic.margem || '';
  renderAnalysisResult('[data-diagnostic-result]', diagnostic.resultados || {});
  goToDashboardTab('diagnostics');
}

async function deleteDiagnostic(id) {
  await apiRequest(`/api/diagnosticos/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await loadDiagnostics();
  showToast('Diagnóstico excluído.', 'success');
}

async function saveProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    nome: form.elements.nome.value.trim(),
    fantasia: form.elements.fantasia.value.trim(),
    cnpj: onlyDigits(form.elements.cnpj?.value || ''),
    telefone: form.elements.telefone.value.trim(),
    regime: form.elements.regime?.value || '',
    setor: form.elements.setor?.value.trim() || '',
    faturamento: parseMoneyLike(form.elements.faturamento?.value || ''),
    margem: parsePercentLike(form.elements.margem?.value || '', 0)
  };
  await apiRequest('/api/profile', { method: 'PUT', body: JSON.stringify(payload) });
  await Promise.all([loadProfile(), loadDashboard()]);
  showToast('Perfil salvo.', 'success');
}

function handleAuth0Redirect() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (!token) return false;
  persistSession(token, params.get('email') || state.authEmail || 'auth0', 'auth0');
  history.replaceState(null, '', `${location.pathname}#dashboard`);
  loadWorkspaceData().catch((error) => showToast(error.message, 'error'));
  return true;
}

async function loadWorkspaceData() {
  if (!state.token) return;
  const tasks = [
    loadDashboard(),
    loadBanks(),
    loadProfile(),
    loadAnalyses(),
    loadDiagnostics(),
    loadFiscalCalendar()
  ];
  const results = await Promise.allSettled(tasks);
  const failed = results.find((result) => result.status === 'rejected');
  if (failed) {
    const message = failed.reason?.message || 'Não foi possível carregar todos os dados.';
    showToast(message, 'error');
    if (/token|jwt|unauthorized|401/i.test(message)) clearSession();
  }
  renderBusinessDashboards();
}

function bindEvents() {
  $$('[data-open-login]').forEach((button) => button.addEventListener('click', () => openModal('[data-login-modal]')));
  $$('[data-open-register]').forEach((button) => button.addEventListener('click', () => openModal('[data-register-modal]')));
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModals));
  $$('[data-auth-tab]').forEach((button) => button.addEventListener('click', () => setAuthTab(button.dataset.authTab)));
  $$('[data-tab]').forEach((button) => button.addEventListener('click', () => setDashboardTab(button.dataset.tab)));

  document.addEventListener('click', (event) => {
    const goButton = event.target.closest('[data-go-tab]');
    if (!goButton) return;
    event.preventDefault();
    goToDashboardTab(goButton.dataset.goTab);
  });

  $('[data-send-code]')?.addEventListener('click', (event) => sendCode(event.currentTarget).catch((error) => showToast(error.message, 'error')));
  $('[data-verify-code]')?.addEventListener('click', (event) => verifyCode(event.currentTarget).catch((error) => showToast(error.message, 'error')));
  $('[data-login-cnpj-submit]')?.addEventListener('click', (event) => loginCnpj(event.currentTarget).catch((error) => showToast(error.message, 'error')));
  $('[data-register-form]')?.addEventListener('submit', (event) => register(event).catch((error) => showToast(error.message, 'error')));
  $('[data-refresh-dashboard]')?.addEventListener('click', () => loadWorkspaceData().catch((error) => showToast(error.message, 'error')));
  $('[data-connect-bank]')?.addEventListener('click', (event) => connectBank(event.currentTarget).catch((error) => showToast(error.message, 'error')));
  $('[data-profile-form]')?.addEventListener('submit', (event) => saveProfile(event).catch((error) => showToast(error.message, 'error')));
  $('[data-profile-form] input[name="cnpj"]')?.addEventListener('input', (event) => {
    event.target.value = formatCnpj(event.target.value);
  });
  $('[data-diagnostic-form]')?.addEventListener('submit', (event) => submitDiagnostic(event).catch((error) => showToast(error.message, 'error')));
  $('[data-ai-upload-form]')?.addEventListener('submit', (event) => uploadAiDocument(event).catch((error) => showToast(error.message, 'error')));
  $('[data-refresh-analyses]')?.addEventListener('click', () => loadAnalyses().catch((error) => showToast(error.message, 'error')));
  $('[data-refresh-diagnostics]')?.addEventListener('click', () => loadDiagnostics().catch((error) => showToast(error.message, 'error')));
  $('[data-public-diagnostic-form]')?.addEventListener('submit', runPublicDiagnostic);
  $('[data-public-diagnostic-form]')?.addEventListener('input', runPublicDiagnostic);
  $('[data-dashboard-tax-form]')?.addEventListener('submit', runDashboardTaxSimulation);
  $('[data-dashboard-tax-form]')?.addEventListener('input', () => runDashboardTaxSimulation());
  $('[data-copy-tax-to-diagnostic]')?.addEventListener('click', copyTaxToDiagnostic);

  $('[data-register-cnpj]')?.addEventListener('input', (event) => {
    const cnpj = onlyDigits(event.target.value);
    event.target.value = formatCnpj(cnpj);
    $('[data-company-preview]').textContent = cnpj.length === 14
      ? `Conta será criada para o CNPJ ${formatCnpj(cnpj)}.`
      : 'Informe o CNPJ para criar a conta.';
    clearTimeout(state.cnpjTimer);
    state.cnpjTimer = setTimeout(() => lookupCnpj(cnpj).catch((error) => {
      $('[data-cnpj-result]').textContent = error.message || 'Não foi possível consultar este CNPJ agora.';
    }), 450);
  });

  $$('[data-select-plan]').forEach((button) => button.addEventListener('click', () => {
    state.pendingPlan = button.dataset.selectPlan;
    $('[data-register-plan]').value = state.pendingPlan;
    openModal('[data-register-modal]');
  }));

  $('[data-bank-list]')?.addEventListener('click', (event) => {
    const syncButton = event.target.closest('[data-sync-bank]');
    const removeButton = event.target.closest('[data-remove-bank]');
    if (syncButton) syncBank(syncButton.dataset.syncBank).catch((error) => showToast(error.message, 'error'));
    if (removeButton) removeBank(removeButton.dataset.removeBank).catch((error) => showToast(error.message, 'error'));
  });

  $('[data-diagnostics-list]')?.addEventListener('click', (event) => {
    const useButton = event.target.closest('[data-use-diagnostic]');
    const deleteButton = event.target.closest('[data-delete-diagnostic]');
    if (useButton) useDiagnostic(useButton.dataset.useDiagnostic);
    if (deleteButton) deleteDiagnostic(deleteButton.dataset.deleteDiagnostic).catch((error) => showToast(error.message, 'error'));
  });

  $('[data-logout]')?.addEventListener('click', () => {
    const provider = state.provider;
    clearSession();
    if (provider === 'auth0') window.location.href = '/api/auth/auth0/logout';
    else showToast('Sessão encerrada.', 'success');
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
  runPublicDiagnostic();
  const handledRedirect = handleAuth0Redirect();
  updateSessionUi();
  if (state.token && !handledRedirect) {
    loadWorkspaceData().catch((error) => {
      showToast(error.message, 'error');
      if (/token|jwt|unauthorized|401/i.test(error.message)) clearSession();
    });
  }
});
