import { $, $$, formatCurrency, formatPercent, onlyDigits, escapeHtml, formatCnpj, parseMoneyLike, parsePercentLike, formatDate, formatRegime, inferActivity, debounce, removeSkeletons, setLoading, showToast, trapFocus, untrapFocus } from './js/utils.js';
import { apiRequest } from './js/api.js';
import { renderPublicExperience } from './js/publicLanding.js';
import { state, MAX_UPLOAD_BYTES } from './js/state.js';

/* Theme */
function initTheme() {
  const saved = localStorage.getItem('finpj_theme');
  const isDark = saved === 'dark';
  if (isDark) {
    document.documentElement.classList.add('dark-mode');
  } else {
    document.documentElement.classList.remove('dark-mode');
  }
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
}
function toggleTheme() {
  const isDark = !document.documentElement.classList.contains('dark-mode');
  if (isDark) {
    document.documentElement.classList.add('dark-mode');
  } else {
    document.documentElement.classList.remove('dark-mode');
  }
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  localStorage.setItem('finpj_theme', isDark ? 'dark' : 'light');
}
initTheme();

const DASHBOARD_TAB_LABELS = {
  overview: 'Visão geral',
  financial: 'Análise financeira',
  statements: 'Balanço e demonstrativos',
  tax: 'Inteligência tributária',
  diagnostics: 'Diagnóstico fiscal',
  ai: 'Análise IA',
  insights: 'Insights acionáveis',
  openfinance: 'Open Finance',
  profile: 'Perfil'
};

const DASHBOARD_CLIENT_CACHE_TTL_MS = 60 * 1000;
const dashboardMemoryCache = new Map();
let chartModulePromise = null;
let chartObserver = null;
let landingRevealObserver = null;
let addCompanyPrompted = false;
const PUBLIC_MODAL_ROUTES = {
  '/login': '[data-login-modal]',
  '/cadastro': '[data-register-modal]',
  '/signup': '[data-register-modal]'
};

/* Service Worker */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

function calculateTaxSimulation({ faturamento, margem, atividade }) {
  if (!window.FinPJTax?.simulateTaxes) {
    throw new Error('Motor tributário indisponível. Recarregue a página.');
  }
  return window.FinPJTax.simulateTaxes({
    annualRevenue: faturamento,
    margin: margem,
    activity: atividade
  });
}

function pickFiniteNumber(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

function normalizeRegimeResult(regime = {}) {
  const annualTax = pickFiniteNumber(regime.annualTax, regime.tax, regime.monthlyTax * 12, regime.monthly * 12);
  const monthlyTax = pickFiniteNumber(regime.monthlyTax, regime.monthly, annualTax / 12);
  return {
    ...regime,
    annualTax,
    tax: annualTax,
    monthlyTax,
    monthly: monthlyTax,
    effectiveRate: pickFiniteNumber(regime.effectiveRate)
  };
}

function calculatePublicRegime(params) {
  return calculateTaxSimulation(params).regimes.map(normalizeRegimeResult);
}

/* apiRequest imported from ./js/api.js */

function currentPublicPath() {
  const normalized = window.location.pathname.replace(/\/+$/, '');
  return normalized || '/';
}

function currentPublicModalSelector() {
  return PUBLIC_MODAL_ROUTES[currentPublicPath()] || '';
}

function setMobileMenuOpen(open) {
  const menu = $('[data-mobile-menu]');
  const toggle = $('[data-mobile-menu-toggle]');
  if (!menu || !toggle) return;
  menu.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('landing-menu-open', open);
}

function closeMobileMenu() {
  setMobileMenuOpen(false);
}

function clearPublicModalRoute() {
  if (!currentPublicModalSelector()) return;
  history.replaceState(null, '', '/');
}

function closeAuthModals() {
  ['[data-login-modal]', '[data-register-modal]'].forEach((selector) => {
    const modal = $(selector);
    if (!modal) return;
    untrapFocus(modal);
    if (typeof modal.close === 'function' && modal.open) modal.close();
    modal.classList.add('is-hidden');
  });
}

function openPublicAuthRoute(selector, path) {
  if (state.token) {
    location.hash = '#dashboard';
    return;
  }
  if (currentPublicPath() !== path) history.pushState(null, '', path);
  closeMobileMenu();
  openModal(selector);
}

function syncPublicRouteModal() {
  if (state.token) {
    closeAuthModals();
    closeMobileMenu();
    return;
  }
  const selector = currentPublicModalSelector();
  if (selector) openModal(selector);
  else closeAuthModals();
}

function initLandingReveal() {
  const items = $$('[data-reveal]');
  if (!items.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((item) => item.classList.add('is-visible'));
    return;
  }
  landingRevealObserver?.disconnect();
  landingRevealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      landingRevealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -40px 0px' });
  items.forEach((item) => landingRevealObserver.observe(item));
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
  clearDashboardClientCache();
  addCompanyPrompted = false;
  state.token = '';
  state.authEmail = '';
  state.provider = 'local';
  state.dashboard = null;
  state.profile = null;
  state.banks = [];
  state.openFinanceSummary = null;
  state.openFinanceTransactions = [];
  state.analyses = [];
  state.diagnostics = [];
  state.activeCompanyId = '';
  localStorage.removeItem('finpj_token');
  localStorage.removeItem('finpj_email');
  localStorage.removeItem('finpj_provider');
  localStorage.removeItem('finpj_active_company');
  updateSessionUi();
}

function updateSessionUi() {
  const logged = Boolean(state.token);
  const mainNav = $('[data-main-nav]');
  const navLinks = $$('[data-nav-link]');
  document.body?.classList.toggle('app-session', logged);
  
  // Mostrar navegação apenas quando logado
  if (mainNav) {
    mainNav.classList.toggle('is-hidden', logged);
  }
  
  // Controlar links individuais: Dashboard só aparece logado, Recursos/Planos escondidos quando logado
  navLinks.forEach((link) => {
    link.classList.toggle('is-hidden', logged && link.hasAttribute('data-auth-only'));
  });
  
  $('[data-public-area]')?.classList.toggle('is-hidden', logged);
  $$('[data-open-login], [data-open-register]').forEach((el) => el.classList.toggle('is-hidden', logged));
  $$('[data-logout]').forEach((el) => el.classList.toggle('is-hidden', !logged));
  $('[data-dashboard]')?.classList.toggle('is-hidden', !logged);
  if (logged) $('[data-user-title]').textContent = `Dashboard ${state.authEmail || ''}`.trim();
  if (logged && currentPublicModalSelector()) history.replaceState(null, '', '/');
  if (logged) closeMobileMenu();
  if (logged && location.hash !== '#dashboard') location.hash = '#dashboard';
}

function openModal(selector) {
  const modal = $(selector);
  if (!modal) return;
  modal.classList.remove('is-hidden');
  if (typeof modal.showModal === 'function') modal.showModal();
  else modal.classList.remove('is-hidden');
  trapFocus(modal);
}

function closeModals() {
  $$('.modal').forEach((modal) => {
    untrapFocus(modal);
    if (typeof modal.close === 'function') modal.close();
    modal.classList.add('is-hidden');
  });
  clearPublicModalRoute();
}

export { openModal, closeModals, toggleTheme };

function setAuthTab(tab) {
  $$('[data-auth-tab]').forEach((button) => button.classList.toggle('is-active', button.dataset.authTab === tab));
  $$('[data-auth-panel]').forEach((panel) => panel.classList.toggle('is-hidden', panel.dataset.authPanel !== tab));
}

function setDashboardTab(tab) {
  $$('[data-tab]').forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $$('[data-panel]').forEach((panel) => panel.classList.toggle('is-hidden', panel.dataset.panel !== tab));
  const currentSection = $('[data-current-section]');
  if (currentSection) currentSection.textContent = DASHBOARD_TAB_LABELS[tab] || tab;

  if (tab === 'openfinance') loadBanks().catch((error) => showToast(error.message, 'error'));
  if (tab === 'profile') loadProfile().catch((error) => showToast(error.message, 'error'));
  if (tab === 'ai') loadAnalyses().catch((error) => showToast(error.message, 'error'));
  if (tab === 'diagnostics') loadDiagnostics().catch((error) => showToast(error.message, 'error'));
  if (tab === 'tax') loadFiscalCalendar().catch((error) => showToast(error.message, 'error'));
  if (tab === 'financial') {
    const metrics = buildMetrics();
    renderReportsTable(metrics.reports);
    renderFinancialDeepDive(metrics);
  }
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

function activeCompanyId() {
  return state.activeCompanyId || $('[data-company-switcher]')?.value || '';
}

function withCompanyQuery(path, companyId = activeCompanyId()) {
  if (!companyId) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}companyId=${encodeURIComponent(companyId)}`;
}

function clearDashboardClientCache(companyId) {
  const keys = companyId ? [dashboardCacheKey(companyId)] : [];
  if (!keys.length) {
    dashboardMemoryCache.clear();
    try {
      Object.keys(sessionStorage)
        .filter((key) => key.startsWith('finpj_dashboard_'))
        .forEach((key) => sessionStorage.removeItem(key));
    } catch {
      // Session storage can be unavailable in private contexts.
    }
    return;
  }

  keys.forEach((key) => {
    dashboardMemoryCache.delete(key);
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Session storage can be unavailable in private contexts.
    }
  });
}

function annualRevenueFromMonthlyInput(value) {
  const monthlyRevenue = parseMoneyLike(value);
  return monthlyRevenue ? Math.round(monthlyRevenue * 12) : 0;
}

function dashboardCacheKey(companyId = activeCompanyId()) {
  return `finpj_dashboard_${state.authEmail || 'session'}_${companyId || 'default'}`;
}

function readCachedDashboard(companyId = activeCompanyId()) {
  const key = dashboardCacheKey(companyId);
  const memory = dashboardMemoryCache.get(key);
  if (memory && memory.expiresAt > Date.now()) return memory.dashboard;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached?.dashboard || cached.expiresAt <= Date.now()) {
      sessionStorage.removeItem(key);
      return null;
    }
    dashboardMemoryCache.set(key, cached);
    return cached.dashboard;
  } catch {
    return null;
  }
}

function writeCachedDashboard(dashboard) {
  const companyId = dashboard?.currentCompanyId || dashboard?.user?.companyId || activeCompanyId();
  const key = dashboardCacheKey(companyId);
  const cached = {
    dashboard,
    expiresAt: Date.now() + DASHBOARD_CLIENT_CACHE_TTL_MS
  };
  dashboardMemoryCache.set(key, cached);
  try {
    sessionStorage.setItem(key, JSON.stringify(cached));
  } catch {
    // Session storage can be unavailable in private contexts.
  }
}

function resetCompanyContext(companyId) {
  state.activeCompanyId = companyId || '';
  localStorage.setItem('finpj_active_company', state.activeCompanyId);
  state.dashboard = null;
  state.profile = null;
  state.banks = [];
  state.openFinanceSummary = null;
  state.openFinanceTransactions = [];
  state.analyses = [];
  state.diagnostics = [];
}

function normalizeDashboardSearch(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function findDashboardTabByQuery(query) {
  const normalized = normalizeDashboardSearch(query);
  if (!normalized) return '';
  const aliases = [
    { tab: 'overview', terms: ['visao geral', 'resumo', 'inicio', 'home', 'overview'] },
    { tab: 'financial', terms: ['financeiro', 'financas', 'fluxo', 'caixa', 'transacoes', 'movimentos'] },
    { tab: 'statements', terms: ['dre', 'balanco', 'demonstrativos', 'ebitda'] },
    { tab: 'tax', terms: ['tributario', 'tributos', 'impostos', 'regimes', 'simples', 'lucro'] },
    { tab: 'diagnostics', terms: ['diagnostico', 'fiscal', 'economia'] },
    { tab: 'ai', terms: ['ia', 'documento', 'documentos', 'upload', 'analise'] },
    { tab: 'insights', terms: ['insights', 'prioridades', 'acoes', 'recomendacoes'] },
    { tab: 'openfinance', terms: ['open finance', 'banco', 'bancos', 'saldo', 'conciliacao'] },
    { tab: 'profile', terms: ['perfil', 'empresa', 'cadastro', 'cnpj'] }
  ];
  return aliases.find(({ tab, terms }) => (
    normalizeDashboardSearch(DASHBOARD_TAB_LABELS[tab]).includes(normalized)
    || terms.some((term) => term.includes(normalized) || normalized.includes(term))
  ))?.tab || '';
}

function renderTaxRows(selector, regimes) {
  const target = $(selector);
  if (!target) return;
  target.innerHTML = '';
  const normalized = regimes.map(normalizeRegimeResult);
  const eligible = normalized.filter((regime) => regime.eligible !== false);
  const bestKey = eligible[0]?.key;
  normalized.forEach((regime) => {
    const annualTax = regime.annualTax ?? regime.tax ?? 0;
    const monthlyTax = regime.monthlyTax ?? regime.monthly ?? annualTax / 12;
    const isBest = regime.eligible !== false && regime.key === bestKey;
    const row = document.createElement('div');
    row.className = `regime-row ${isBest ? 'is-best' : ''}`;
    if (regime.eligible === false) {
      row.classList.remove('is-best');
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(regime.name)}</strong>
          <small>${escapeHtml(regime.reason || 'Regime não aplicável aos dados informados.')}</small>
        </div>
        <span>-</span>
      `;
      target.appendChild(row);
      return;
    }
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(regime.name)}</strong>
        <small>${isBest ? 'Melhor estimativa' : `Alíquota efetiva ${formatPercent(regime.effectiveRate)}`}</small>
      </div>
      <span>${formatCurrency(monthlyTax)}/mês</span>
    `;
    if (regime.eligible !== false) {
      const detail = document.createElement('small');
      detail.className = 'regime-row-detail';
      const savings = regime.savingsComparedToWorst?.annual || 0;
      detail.textContent = `Anual ${formatCurrency(annualTax)} | mensal ${formatCurrency(monthlyTax)} | aliquota efetiva ${formatPercent(regime.effectiveRate)}${savings ? ` | economia vs pior ${formatCurrency(savings)}` : ''}`;
      $('div', row)?.appendChild(detail);
    }
    target.appendChild(row);
  });
}

function setPublicSimulatorCheck(name, done, text) {
  const item = $(`[data-public-simulator-checks] [data-check="${name}"]`);
  if (!item) return;
  item.classList.toggle('is-done', done);
  item.textContent = text;
}

function resetPublicDiagnostic(message = 'Digite o CNPJ para liberar a análise do melhor regime.', title = 'Aguardando CNPJ') {
  const titleEl = $('[data-public-best-regime]');
  const copyEl = $('[data-public-diagnostic-copy]');
  const statusEl = $('[data-public-simulator-status]');
  const resultCard = $('.simulator-result');
  if (titleEl) titleEl.textContent = title;
  if (copyEl) copyEl.textContent = message;
  if (statusEl) statusEl.textContent = message;
  resultCard?.classList.remove('has-result');
  renderTaxRows('[data-regime-comparison]', []);
}

function updatePublicSimulatorReadyState() {
  const form = $('[data-public-diagnostic-form]');
  if (!form) return false;
  const cnpjOk = onlyDigits(form.elements.cnpj?.value).length === 14;
  const faturamento = parseMoneyLike(form.elements.faturamento?.value);
  const margem = parsePercentLike(form.elements.margem?.value);
  const premissasOk = faturamento > 0 && Number.isFinite(margem) && margem >= 0;
  const atividadeLabel = $('[data-company-atividade]')?.textContent?.trim();
  const button = $('[data-public-simulate-button]');
  if (button) button.disabled = !(cnpjOk && premissasOk);

  setPublicSimulatorCheck('cnpj', cnpjOk, cnpjOk ? 'CNPJ informado' : 'CNPJ pendente');
  setPublicSimulatorCheck('premissas', premissasOk, premissasOk ? 'Premissas prontas' : 'Premissas pendentes');
  setPublicSimulatorCheck('atividade', Boolean(atividadeLabel), atividadeLabel || 'Atividade a detectar');
  return cnpjOk && premissasOk;
}

function renderPublicDiagnostic(regimes, annualRevenue) {
  const normalized = regimes.map(normalizeRegimeResult);
  const eligible = normalized.filter((regime) => regime.eligible !== false);
  const best = eligible[0] || normalized[0];
  const worst = eligible[eligible.length - 1] || best;
  const form = $('[data-public-diagnostic-form]');
  const regimeAtual = form?.elements?.regime_atual?.value;
  if (!best) {
    resetPublicDiagnostic('Informe CNPJ, faturamento e margem para comparar os regimes.', 'Sem dados suficientes');
    return;
  }

  // Calculate economy vs worst
  const economyVsWorst = Math.max(0, worst.tax - best.tax);

  // Calculate economy vs current regime if specified
  let economyVsCurrent = 0;
  let currentRegimeName = '';
  if (regimeAtual) {
    const currentRegime = regimes.find(r => r.key === regimeAtual);
    if (currentRegime && currentRegime.eligible !== false) {
      economyVsCurrent = Math.max(0, currentRegime.tax - best.tax);
      currentRegimeName = currentRegime.name;
    }
  }

  // Build message
  let message = 'Preencha os dados para visualizar uma comparação tributária prévia.';
  if (annualRevenue && best) {
    const parts = [`Estimativa anual de impostos no melhor regime: ${formatCurrency(best.tax)}`];

    if (economyVsWorst > 0) {
      parts.push(`economia vs pior cenário: ${formatCurrency(economyVsWorst)}`);
    }

    if (economyVsCurrent > 0 && currentRegimeName) {
      parts.push(`economia vs seu regime atual (${currentRegimeName}): ${formatCurrency(economyVsCurrent)}`);
    }

    message = parts.join('. ') + '.';
  }

  $('[data-public-best-regime]').textContent = best?.name || 'Aguardando CNPJ';
  $('[data-public-diagnostic-copy]').textContent = message;
  const statusEl = $('[data-public-simulator-status]');
  if (statusEl) statusEl.textContent = 'Comparação atualizada com os dados informados.';
  $('.simulator-result')?.classList.add('has-result');
  renderTaxRows('[data-regime-comparison]', normalized);
  updatePublicSimulatorReadyState();
}

function inferActivityFromCnae(cnaeCode, cnaeDesc = '') {
  const code = String(cnaeCode || '').replace(/\D/g, '').slice(0, 7);
  const desc = String(cnaeDesc || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // CNAE ranges for different activities
  const comercioRanges = [
    [4700000, 4799999], // Comércio varejista
    [4500000, 4599999], // Comércio de veículos
    [4600000, 4699999], // Comércio atacadista (exceto veículos)
    [4100000, 4399999], // Construção (some construction also has commerce aspects)
    [4900000, 4999999], // Transporte (some logistics)
  ];
  const servicosRanges = [
    [6200000, 6399999], // Tecnologia da informação
    [6900000, 6999999], // Atividades jurídicas, contábeis
    [7000000, 7499999], // Atividades profissionais, científicas e técnicas
    [7500000, 7599999], // Veterinária
    [7700000, 7999999], // Aluguel, viagens, turismo
    [8000000, 8299999], // Educação
    [8500000, 8599999], // Saúde humana
    [8600000, 8699999], // Atividades de atenção à saúde humana
    [9000000, 9399999], // Artes, cultura, esporte, recreação
    [9400000, 9499999], // Associações
    [9500000, 9599999], // Reparação de equipamentos
    [9600000, 9699999], // Outras atividades de serviços pessoais
  ];
  const industriaRanges = [
    [1000000, 3299999], // Indústrias de transformação
    [5000000, 5199999], // Eletricidade e gás
  ];

  const codeNum = parseInt(code, 10);
  if (!isNaN(codeNum)) {
    for (const [start, end] of comercioRanges) {
      if (codeNum >= start && codeNum <= end) return 'comercio';
    }
    for (const [start, end] of servicosRanges) {
      if (codeNum >= start && codeNum <= end) return 'servicos';
    }
    for (const [start, end] of industriaRanges) {
      if (codeNum >= start && codeNum <= end) return 'industria';
    }
  }

  // Fallback to description analysis
  if (/comerc|varejo|atacad|loja|mercad|revenda|distribuica/.test(desc)) return 'comercio';
  if (/industr|fabric|manuf|producao|beneficiamento|montagem/.test(desc)) return 'industria';
  if (/servic|consult|clinica|agencia|software|profissional|escritorio|assistencia|locacao|turismo|restaurante|alimentacao/.test(desc)) return 'servicos';

  return 'comercio'; // Default
}

function formatContabil(value) {
  // Format as contabil: 480000 -> 480.000,00
  const num = typeof value === 'number' ? value : parseMoneyLike(value);
  if (!Number.isFinite(num)) return '';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

function formatAsPercent(value) {
  // Format percentage for display: 0.12 -> 12, 12 -> 12
  const num = typeof value === 'number' ? value : parsePercentLike(value);
  if (!Number.isFinite(num)) return '';
  // If already > 1, assume it's already a percentage number
  const pct = num > 1 ? num : Math.round(num * 100);
  return String(pct);
}

function formatCurrencyInput(value) {
  // Format input as user types: keep only digits and format with thousand separators
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100; // Convert to decimal (cents to units)
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

function formatPercentInput(value) {
  // Format input as user types for percentage
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits;
}

async function lookupCnpjForSimulator(cnpj) {
  const cleanCnpj = onlyDigits(cnpj);
  if (cleanCnpj.length !== 14) return;

  try {
    const statusEl = $('[data-public-simulator-status]');
    if (statusEl) statusEl.textContent = 'Consultando dados públicos do CNPJ...';
    const data = await apiRequest(`/api/cnpj?cnpj=${cleanCnpj}`);
    if (!data || data.erro) {
      showToast(data?.erro || 'CNPJ não encontrado', 'error');
      resetPublicDiagnostic('Não foi possível validar este CNPJ nas bases públicas.', 'CNPJ não localizado');
      return;
    }
    const form = $('[data-public-diagnostic-form]');
    if (form) form.dataset.cnpjLoaded = cleanCnpj;

    // Update company info display
    const companyInfo = $('[data-company-info]');
    const nomeEl = $('[data-company-nome]');
    const cnaeEl = $('[data-company-cnae]');
    const atividadeEl = $('[data-company-atividade]');
    const atividadeInput = $('[data-atividade-input]');

    if (nomeEl) nomeEl.textContent = data.nome || '-';
    if (cnaeEl) cnaeEl.textContent = data.cnae_descricao || data.cnae || '-';

    // Infer activity from CNAE
    const activity = inferActivityFromCnae(data.cnae_fiscal, data.cnae_descricao);
    const activityLabel = { comercio: 'Comércio', servicos: 'Serviços', industria: 'Indústria' }[activity] || activity;

    if (atividadeEl) atividadeEl.textContent = activityLabel;
    if (atividadeInput) atividadeInput.value = activity;

    if (companyInfo) companyInfo.style.display = 'grid';
    updatePublicSimulatorReadyState();

    // Auto-calculate based on new data
    runPublicDiagnostic();
  } catch (error) {
    resetPublicDiagnostic('Falha ao consultar o CNPJ. Verifique o número e tente novamente.', 'CNPJ não validado');
    showToast(error.message || 'Erro ao consultar CNPJ', 'error');
  }
}

function runPublicDiagnostic(event) {
  event?.preventDefault();
  const form = $('[data-public-diagnostic-form]');
  if (!form) return;
  const cnpj = onlyDigits(form.elements.cnpj.value);
  const faturamento = parseMoneyLike(form.elements.faturamento.value);
  const margem = parsePercentLike(form.elements.margem.value);
  const atividade = form.elements.atividade.value;
  updatePublicSimulatorReadyState();

  if (cnpj.length !== 14) {
    resetPublicDiagnostic('Digite o CNPJ antes de calcular o melhor regime.', 'Aguardando CNPJ');
    return;
  }

  if (!faturamento || !Number.isFinite(margem) || margem < 0) {
    resetPublicDiagnostic('CNPJ informado. Agora preencha faturamento anual e margem estimada.', 'CNPJ informado');
    return;
  }

  try {
    const regimes = calculatePublicRegime({ faturamento, margem, atividade });
    renderPublicDiagnostic(regimes, faturamento);
  } catch (error) {
    $('[data-public-best-regime]').textContent = 'Dados inválidos';
    $('[data-public-diagnostic-copy]').textContent = error.message;
    const statusEl = $('[data-public-simulator-status]');
    if (statusEl) statusEl.textContent = 'Revise as premissas para recalcular.';
    $('.simulator-result')?.classList.remove('has-result');
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

function finiteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function buildMetrics(dashboard = state.dashboard || {}) {
  const user = getCurrentUser();
  const reports = dashboard.reports || [];
  const summary = dashboard.summary || {};
  const backendMetrics = dashboard.metrics || {};
  const backendFiscal = backendMetrics.fiscal || {};
  const overview = dashboard.overview || {};
  const overviewKpis = overview.kpis || {};
  const openFinanceSummary = state.openFinanceSummary || summary.openFinance || {};
  const transactions = getBankTransactions();
  const importedMonthlyIncome = transactions
    .filter((item) => Number(item.valor) > 0 || item.tipo === 'entrada')
    .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0);
  const importedMonthlyExpenses = transactions
    .filter((item) => Number(item.valor) < 0 || item.tipo === 'saida')
    .reduce((sum, item) => sum + Math.abs(Number(item.valor) || 0), 0);
  const monthlyIncome = finiteNumber(backendMetrics.monthlyIncome ?? backendMetrics.monthlyRevenue ?? overviewKpis.monthlyRevenue?.value)
    || importedMonthlyIncome
    || finiteNumber(openFinanceSummary.monthlyIncome);
  const monthlyExpenses = finiteNumber(backendMetrics.monthlyExpenses)
    || importedMonthlyExpenses
    || finiteNumber(openFinanceSummary.monthlyExpenses);

  const totalMovimentado = Number(summary.totalMovimentado || 0);
  const annualRevenue = finiteNumber(backendMetrics.annualRevenue)
    || Number(user.faturamento || user.faturamentoAnual || 0)
    || finiteNumber(overviewKpis.monthlyRevenue?.value) * 12
    || (monthlyIncome ? Math.round(monthlyIncome * 12) : Math.round(totalMovimentado));
  const informedMargin = finiteNumber(backendMetrics.margin, NaN);
  const marginSource = Number.isFinite(informedMargin) ? informedMargin : finiteNumber(overviewKpis.profitMargin?.value, Number(user.margem || user.margemEstimada || 0));
  const margin = marginSource > 1 ? marginSource / 100 : marginSource || 0;
  const profit = finiteNumber(backendMetrics.profit) || Math.round(annualRevenue * margin);
  const expenses = finiteNumber(backendMetrics.expenses) || Math.max(0, annualRevenue - profit);
  const activity = inferActivity(user.setor);
  let regimes = Array.isArray(backendFiscal.regimes) ? backendFiscal.regimes.map(normalizeRegimeResult) : [];
  let bestRegime = normalizeRegimeResult(backendFiscal.bestRegime || { name: 'Nao calculado', tax: 0, annualTax: 0, monthly: 0, monthlyTax: 0, effectiveRate: 0 });
  try {
    regimes = !backendFiscal.bestRegime && annualRevenue && margin > 0
      ? calculatePublicRegime({ faturamento: annualRevenue, margem: margin, atividade: activity })
      : regimes;
    bestRegime = backendFiscal.bestRegime ? normalizeRegimeResult(backendFiscal.bestRegime) : (regimes[0] || bestRegime);
  } catch {
    regimes = regimes || [];
  }
  const currentRegime = formatRegime(user.regime || '');
  const currentRegimeItem = regimes.find((regime) => regime.name === currentRegime);
  const calculatedTaxGap = regimes.length
    ? (currentRegimeItem ? Math.max(0, currentRegimeItem.tax - bestRegime.tax) : Math.max(0, regimes[regimes.length - 1].tax - bestRegime.tax))
    : 0;
  const taxGap = finiteNumber(backendFiscal.taxSavings ?? overviewKpis.taxSavings?.value) || calculatedTaxGap;
  const annualTax = finiteNumber(backendFiscal.annualTax ?? bestRegime.annualTax ?? bestRegime.tax ?? (overviewKpis.monthlyTaxes?.value * 12));
  const monthlyTax = finiteNumber(backendFiscal.monthlyTax ?? overviewKpis.monthlyTaxes?.value ?? bestRegime.monthlyTax ?? bestRegime.monthly);
  const taxPaid = finiteNumber(backendMetrics.taxPaid ?? overviewKpis.monthlyTaxes?.value ?? openFinanceSummary.taxPaid);
  const bankBalance = finiteNumber(backendMetrics.bankBalance ?? openFinanceSummary.bankBalance, monthlyIncome - monthlyExpenses);

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
    monthlyBalance: bankBalance,
    bankBalance,
    annualTax,
    monthlyTax,
    taxPaid,
    pendencias: finiteNumber(backendMetrics.pendingItems ?? summary.pendencias),
    activity,
    regimes,
    bestRegime,
    currentRegime,
    taxGap,
    monthlyRevenue: finiteNumber(backendMetrics.monthlyRevenue ?? overviewKpis.monthlyRevenue?.value ?? monthlyIncome),
    alertsCount: finiteNumber(overviewKpis.alerts?.value ?? backendMetrics.pendingItems ?? summary.pendencias),
    connectedBanks: finiteNumber(backendMetrics.connectedBanks),
    overview
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
      text: metrics.connectedBanks ? `${metrics.connectedBanks} banco(s) conectado(s).` : 'Conectar pelo menos uma conta PJ.',
      done: metrics.connectedBanks > 0,
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
  if (!metrics.connectedBanks) {
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

function renderDashboardContext(metrics) {
  const user = metrics.user || {};
  const companyName = user.fantasia || user.nome || user.nomeEmpresa || user.email || 'Empresa sem nome';
  const cnpj = user.cnpj ? formatCnpj(user.cnpj) : 'CNPJ nao informado';
  const regime = formatRegime(user.regime || '');
  const companyEl = $('[data-dashboard-company]');
  const contextEl = $('[data-dashboard-context]');
  if (companyEl) companyEl.textContent = companyName;
  if (contextEl) {
    contextEl.textContent = `${cnpj} | ${regime} | Plano ${user.plano || 'starter'}`;
  }
  renderCompanySwitcher(state.dashboard);

  const readinessItems = getReadinessItems(metrics);
  const done = readinessItems.filter((item) => item.done).length;
  const readiness = Math.round((done / readinessItems.length) * 100);
  const pulse = $('[data-dashboard-pulse]');
  if (!pulse) return;
  pulse.innerHTML = '';
  [
    {
      label: 'Perfil',
      value: `${readiness}% pronto`,
      tone: readiness >= 80 ? 'success' : 'warning'
    },
    {
      label: 'Regime estimado',
      value: metrics.bestRegime?.name || 'Aguardando dados',
      tone: metrics.bestRegime?.name ? 'success' : 'warning'
    },
    {
      label: 'Bancos',
      value: metrics.connectedBanks ? `${metrics.connectedBanks} conectado(s)` : 'Sem conexao',
      tone: metrics.connectedBanks ? 'success' : 'warning'
    },
    {
      label: 'Diagnosticos',
      value: state.diagnostics.length ? `${state.diagnostics.length} salvo(s)` : 'Nenhum salvo',
      tone: state.diagnostics.length ? 'success' : ''
    }
  ].forEach((item) => {
    const el = document.createElement('span');
    el.className = `pulse-item ${item.tone ? `is-${item.tone}` : ''}`;
    el.innerHTML = `<strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.value)}</small>`;
    pulse.appendChild(el);
  });
}

function renderCompanySwitcher(dashboard = state.dashboard) {
  const select = $('[data-company-switcher]');
  if (!select || !dashboard) return;
  const companies = dashboard.companies?.length
    ? dashboard.companies
    : [{
      id: dashboard.currentCompanyId || dashboard.user?.companyId || dashboard.user?.cnpj || 'default',
      name: dashboard.user?.fantasia || dashboard.user?.nome || dashboard.user?.email || 'Empresa atual',
      cnpj: dashboard.user?.cnpj || ''
    }];
  const currentId = dashboard.currentCompanyId || companies.find((company) => company.active)?.id || companies[0]?.id || '';
  select.innerHTML = companies.map((company) => {
    const cnpj = company.cnpj ? ` - ${formatCnpj(company.cnpj)}` : '';
    return `<option value="${escapeHtml(company.id)}">${escapeHtml(company.name || 'Empresa sem nome')}${escapeHtml(cnpj)}</option>`;
  }).join('');
  select.value = currentId;
  state.activeCompanyId = currentId;
  localStorage.setItem('finpj_active_company', currentId);
}

function setKpi(name, value, note, options = {}) {
  const valueEl = $(`[data-kpi="${name}"]`);
  const noteEl = $(`[data-kpi-note="${name}"]`);
  const card = $(`[data-kpi-card="${name}"]`);
  if (valueEl) {
    valueEl.textContent = value;
    removeSkeletons(valueEl);
  }
  if (noteEl) noteEl.textContent = note || '';
  if (card) {
    card.classList.toggle('is-positive', options.tone === 'positive');
    card.classList.toggle('is-negative', options.tone === 'negative');
    removeSkeletons(card);
  }
}

function kpiSourceNote(source, fallback) {
  if (source === 'real') return 'Importado do banco';
  if (source === 'estimated') return 'Estimado pelo perfil';
  return fallback;
}

function renderPrimaryKpis(metrics) {
  const overviewKpis = metrics.overview?.kpis || {};
  setKpi(
    'monthlyRevenue',
    formatCurrency(metrics.monthlyRevenue || metrics.monthlyIncome || 0),
    metrics.monthlyRevenue
      ? kpiSourceNote(overviewKpis.monthlyRevenue?.source, 'Periodo atual')
      : 'Informe faturamento ou conecte banco'
  );
  setKpi(
    'monthlyTaxes',
    formatCurrency(metrics.monthlyTax || metrics.taxPaid || 0),
    metrics.monthlyTax || metrics.taxPaid
      ? kpiSourceNote(overviewKpis.monthlyTaxes?.source, 'Estimativa mensal')
      : 'Sem imposto identificado'
  );
  setKpi(
    'profitMargin',
    formatPercent(metrics.margin || 0),
    metrics.margin
      ? kpiSourceNote(overviewKpis.profitMargin?.source, 'Base do perfil financeiro')
      : 'Margem nao informada',
    { tone: metrics.margin >= 0.15 ? 'positive' : (metrics.margin > 0 && metrics.margin < 0.1 ? 'negative' : '') }
  );
  setKpi(
    'taxSavings',
    formatCurrency(metrics.taxGap || 0),
    metrics.taxGap
      ? kpiSourceNote(overviewKpis.taxSavings?.source, 'Oportunidade anual estimada')
      : 'Sem economia calculada',
    { tone: metrics.taxGap > 0 ? 'positive' : '' }
  );
  setKpi(
    'alerts',
    String(metrics.alertsCount || 0),
    metrics.alertsCount ? 'Pede acao' : 'Sem alertas criticos',
    { tone: metrics.alertsCount ? 'negative' : 'positive' }
  );
}

function renderOverviewInsights(metrics) {
  const target = $('[data-dashboard-alerts]');
  if (!target) return;
  const insights = metrics.overview?.insights?.length ? metrics.overview.insights : [
    {
      severity: 'success',
      title: 'Operacao sem alerta critico',
      text: 'Os dados atuais nao exigem acao imediata.',
      actionTab: 'financial',
      actionLabel: 'Ver detalhes'
    }
  ];
  target.innerHTML = '';
  insights.forEach((item) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `decision-row ${item.severity === 'success' ? 'is-positive' : ''} ${item.severity === 'danger' ? 'is-negative' : ''}`;
    row.dataset.goTab = item.actionTab || 'insights';
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(item.title || 'Insight')}</strong>
        <span>${escapeHtml(item.text || '')}</span>
      </div>
      <small>${escapeHtml(item.actionLabel || 'Abrir')}</small>
    `;
    target.appendChild(row);
  });
}

function lazyRenderTrendChart(trend) {
  const container = $('[data-dashboard-chart]');
  if (!container) return;
  const render = async () => {
    chartModulePromise = chartModulePromise || import('./js/dashboardChart.js');
    const chart = await chartModulePromise;
    chart.renderRevenueTaxTrend(container, trend);
  };

  if (!('IntersectionObserver' in window)) {
    render().catch(() => {
      container.textContent = 'Nao foi possivel carregar o grafico.';
    });
    return;
  }

  if (chartObserver) chartObserver.disconnect();
  chartObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    chartObserver.disconnect();
    render().catch(() => {
      container.textContent = 'Nao foi possivel carregar o grafico.';
    });
  }, { rootMargin: '160px' });
  chartObserver.observe(container);
}

function renderTrendSummary(metrics) {
  const summary = $('[data-trend-summary]');
  if (!summary) return;
  const trend = metrics.overview?.trend;
  if (!trend || trend.empty) {
    summary.textContent = 'Sem historico suficiente para comparar tendencia.';
    return;
  }
  summary.textContent = `Ultimo periodo: receita ${formatCurrency(metrics.monthlyRevenue || 0)} e impostos ${formatCurrency(metrics.monthlyTax || 0)}.`;
}

function setDashboardError(message = '') {
  const target = $('[data-dashboard-error]');
  if (!target) return;
  target.textContent = message;
  target.classList.toggle('is-hidden', !message);
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

/* removeSkeletons imported from ./js/utils.js */

function setDashboardMetric(name, value, note) {
  const el = $(`[data-exec="${name}"]`);
  if (!el) return;
  el.textContent = value;
  removeSkeletons(el.closest('.metric-card') || el.parentElement);
  const noteEl = $(`[data-exec-note="${name}"]`);
  if (noteEl && note) noteEl.textContent = note;
}

function showDashboardSkeletons() {
  $$('[data-kpi], [data-exec], [data-financial]').forEach((el) => {
    el.textContent = '';
    el.classList.add('skeleton', 'skeleton-text');
  });
  $$('[data-kpi-note]').forEach((el) => {
    el.textContent = 'Carregando';
  });
  const chart = $('[data-dashboard-chart]');
  if (chart) {
    chart.classList.add('skeleton', 'skeleton-card');
    chart.textContent = 'Carregando tendencia.';
  }
  const alerts = $('[data-dashboard-alerts]');
  if (alerts) {
    alerts.innerHTML = '<div class="decision-row skeleton skeleton-card"></div><div class="decision-row skeleton skeleton-card"></div>';
  }
  setDashboardError('');
  const pulse = $('[data-dashboard-pulse]');
  if (pulse) {
    pulse.innerHTML = '<span class="pulse-item skeleton skeleton-text"></span><span class="pulse-item skeleton skeleton-text"></span><span class="pulse-item skeleton skeleton-text"></span>';
  }
  const decisionTitle = $('[data-decision-title]');
  if (decisionTitle) decisionTitle.classList.add('skeleton', 'skeleton-title');
  const decisionSummary = $('[data-decision-summary]');
  if (decisionSummary) decisionSummary.classList.add('skeleton', 'skeleton-text');
  const skeletonLists = [
    '[data-executive-summary]',
    '[data-main-alerts]',
    '[data-openfinance-fiscal-signals]'
  ];
  skeletonLists.forEach((selector) => {
    const target = $(selector);
    if (!target) return;
    target.innerHTML = '<div class="insight-item skeleton skeleton-card"></div><div class="insight-item skeleton skeleton-card"></div>';
  });
}

function renderBusinessDashboards(dashboard = state.dashboard) {
  if (!dashboard) return;
  const metrics = buildMetrics(dashboard);
  const user = metrics.user;

  renderDashboardContext(metrics);
  renderPrimaryKpis(metrics);
  renderOverviewInsights(metrics);
  renderTrendSummary(metrics);
  lazyRenderTrendChart(metrics.overview?.trend || {});
  setDashboardMetric(
    'revenue',
    formatCurrency(metrics.monthlyRevenue || metrics.monthlyIncome),
    user.faturamento || user.faturamentoAnual ? 'Mensal pelo perfil empresarial' : (metrics.monthlyIncome ? 'Open Finance' : 'Sem fonte financeira')
  );
  setDashboardMetric(
    'savings',
    formatCurrency(metrics.taxGap),
    metrics.taxGap ? 'Economia vs. regime atual/pior cenario' : 'Sem economia calculada'
  );
  setDashboardMetric(
    'taxes',
    formatCurrency(metrics.annualTax),
    metrics.monthlyTax ? `Mensal ${formatCurrency(metrics.monthlyTax)}` : 'Aguardando premissas fiscais'
  );
  setDashboardMetric(
    'bankBalance',
    formatCurrency(metrics.bankBalance),
    metrics.connectedBanks ? `${metrics.connectedBanks} banco(s) conectado(s)` : 'Aguardando Open Finance'
  );
  const incomeEl = $('[data-financial="income"]');
  if (incomeEl) { incomeEl.textContent = formatCurrency(metrics.monthlyRevenue || metrics.monthlyIncome); removeSkeletons(incomeEl.parentElement); }
  const expensesEl = $('[data-financial="expenses"]');
  if (expensesEl) { expensesEl.textContent = formatCurrency(metrics.monthlyExpenses); removeSkeletons(expensesEl.parentElement); }
  const profitEl = $('[data-financial="profit"]');
  if (profitEl) { profitEl.textContent = formatCurrency((metrics.monthlyRevenue || metrics.monthlyIncome) * metrics.margin); removeSkeletons(profitEl.parentElement); }

  syncDashboardForms(user);
  renderDecisionCenter(metrics);
  renderSetupProgress(metrics);
  renderReportsTable(metrics.reports);
  renderTaxCalendar();

  renderInsightList('[data-executive-summary]', [
    { title: 'Saúde financeira', text: metrics.annualRevenue ? `Margem estimada de ${formatPercent(metrics.margin)} sobre ${formatCurrency(metrics.annualRevenue)} de receita anual.` : 'Complete o perfil para calcular margem, lucro e tributos.' },
    { title: 'Regime fiscal estimado', text: `${metrics.bestRegime.name} é o melhor cenário calculado para os dados atuais.`, actionLabel: 'Comparar regimes', actionTab: 'tax' },
    { title: 'Plano ativo', text: `Plano ${user.plano || 'starter'} com pagamento ${user.statusPagamento || 'pendente'}.` }
  ]);
  renderInsightList('[data-main-alerts]', [
    { title: 'Pendências operacionais', text: `${metrics.pendencias} item(ns) exigem revisão no resumo financeiro.`, actionLabel: 'Ver finanças', actionTab: 'financial' },
    { title: 'Dados bancários', text: metrics.connectedBanks ? `${metrics.connectedBanks} banco(s) conectado(s) ao Open Finance.` : 'Nenhum banco conectado para conciliação automática.', actionLabel: 'Conectar banco', actionTab: 'openfinance' },
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
    { title: 'Open Finance', text: metrics.connectedBanks ? 'Sincronize bancos para manter transações atualizadas.' : 'Conecte a conta PJ para automatizar fluxo de caixa.', actionLabel: 'Abrir Open Finance', actionTab: 'openfinance' },
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
  if (!addCompanyPrompted && !dashboard.user?.cnpj && !(dashboard.companies || []).some((company) => company.cnpj)) {
    addCompanyPrompted = true;
    if ($('[data-add-company-preview]')) {
      $('[data-add-company-preview]').textContent = 'Digite o CNPJ para buscar os dados publicos da empresa.';
    }
    openModal('[data-add-company-modal]');
  }
}

async function loadDashboard(options = {}) {
  if (!state.token) return;
  const companyId = options.companyId ?? activeCompanyId();
  if (options.force) clearDashboardClientCache(companyId);
  const cached = !options.force ? readCachedDashboard(companyId) : null;
  if (cached) renderDashboard(cached);
  const data = await apiRequest(withCompanyQuery('/api/dashboard', companyId));
  if (data.dashboard) writeCachedDashboard(data.dashboard);
  setDashboardError('');
  renderDashboard(data);
}

async function loadProfile(companyId = activeCompanyId()) {
  if (!state.token) return;
  const data = await apiRequest(withCompanyQuery('/api/profile', companyId));
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

function fillAddCompanyFields(data) {
  if (!data) return;
  const nome = data.razao_social || data.nome || data.nomeEmpresa || '';
  const fantasia = data.nome_fantasia || data.fantasia || '';
  const preview = $('[data-add-company-preview]');
  if (preview) {
    preview.textContent = nome
      ? `${nome}${fantasia ? ` (${fantasia})` : ''}`
      : 'CNPJ localizado nas bases publicas.';
  }
  if ($('[data-add-nome]') && !$('[data-add-nome]').value.trim()) {
    $('[data-add-nome]').value = nome || fantasia;
  }
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

async function lookupAddCompanyCnpj(cnpj) {
  const clean = onlyDigits(cnpj);
  const preview = $('[data-add-company-preview]');
  if (!preview) return;
  if (clean.length !== 14) {
    preview.textContent = 'Digite o CNPJ para buscar os dados publicos da empresa.';
    return;
  }
  preview.textContent = 'Buscando dados publicos do CNPJ...';
  const data = await apiRequest(`/api/cnpj?cnpj=${encodeURIComponent(clean)}`);
  fillAddCompanyFields(data);
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

async function loadAnalyses(companyId = activeCompanyId()) {
  if (!state.token) return;
  const data = await apiRequest(withCompanyQuery('/api/analises', companyId));
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

async function loadDiagnostics(companyId = activeCompanyId()) {
  if (!state.token) return;
  const data = await apiRequest(withCompanyQuery('/api/diagnosticos', companyId));
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

async function loadBanks(companyId = activeCompanyId()) {
  if (!state.token) return;
  const [banksResult, summaryResult, transactionsResult] = await Promise.allSettled([
    apiRequest(withCompanyQuery('/api/openfinance/banks', companyId)),
    apiRequest(withCompanyQuery('/api/openfinance/summary', companyId)),
    apiRequest(withCompanyQuery('/api/openfinance/transactions?limit=50', companyId))
  ]);
  if (banksResult.status === 'rejected') throw banksResult.reason;
  state.banks = banksResult.value.banks || [];
  if (summaryResult.status === 'fulfilled') state.openFinanceSummary = summaryResult.value.summary || null;
  if (transactionsResult.status === 'fulfilled') state.openFinanceTransactions = transactionsResult.value.transactions || [];
  renderBanks();
  renderBusinessDashboards();
}

function renderOpenFinanceSummary(metrics = buildMetrics()) {
  const target = $('[data-openfinance-summary]');
  if (!target) return;
  const summary = state.openFinanceSummary || {};
  target.innerHTML = `
    <div class="metric-card"><span>Bancos conectados</span><strong>${escapeHtml(summary.banksCount ?? state.banks.length)}</strong><small>Open Finance</small></div>
    <div class="metric-card"><span>Entradas importadas</span><strong>${escapeHtml(formatCurrency(summary.monthlyIncome ?? metrics.monthlyIncome))}</strong><small>Periodo atual</small></div>
    <div class="metric-card"><span>Saidas importadas</span><strong>${escapeHtml(formatCurrency(summary.monthlyExpenses ?? metrics.monthlyExpenses))}</strong><small>Custos e impostos</small></div>
  `;
  renderOpenFinanceFiscalSignals(metrics);
  renderOpenFinanceTransactionPreview();
}

function renderOpenFinanceFiscalSignals(metrics = buildMetrics()) {
  const summary = state.openFinanceSummary || {};
  const fiscalSignals = summary.fiscalSignals || {};
  renderSummaryRows('[data-openfinance-fiscal-signals]', [
    { label: 'Receita importada', value: formatCurrency(fiscalSignals.importedRevenue ?? summary.monthlyIncome ?? metrics.monthlyIncome), note: 'Entradas bancarias do periodo' },
    { label: 'Base anualizada', value: formatCurrency(fiscalSignals.annualizedRevenue ?? ((summary.monthlyIncome ?? metrics.monthlyIncome) * 12)), note: 'Referencia para simulacao fiscal' },
    { label: 'Saidas tributarias', value: formatCurrency(fiscalSignals.taxOutflow ?? summary.taxPaid ?? metrics.taxPaid), note: 'DAS, DARF, impostos e encargos detectados' },
    { label: 'Peso tributario', value: formatPercent(fiscalSignals.taxOutflowRate || 0), note: 'Impostos pagos sobre entradas importadas' }
  ]);
}

function renderOpenFinanceTransactionPreview() {
  const table = $('[data-openfinance-transaction-preview]');
  if (!table) return;
  const transactions = state.openFinanceTransactions.length ? state.openFinanceTransactions : getBankTransactions();
  table.innerHTML = '';
  if (!transactions.length) {
    table.innerHTML = '<tr><td colspan="4">Conecte um banco para visualizar lancamentos.</td></tr>';
    return;
  }
  transactions
    .slice()
    .sort((a, b) => new Date(b.data || b.date || 0) - new Date(a.data || a.date || 0))
    .slice(0, 8)
    .forEach((transaction) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${escapeHtml(formatDate(transaction.data || transaction.date))}</td>
        <td>${escapeHtml(transaction.bankName || 'Banco')}</td>
        <td>${escapeHtml(transaction.categoria || transaction.category || 'Outros')}</td>
        <td>${escapeHtml(formatCurrency(transaction.valor ?? transaction.amount ?? 0))}</td>
      `;
      table.appendChild(row);
    });
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
  if (!annualRevenueFromMonthlyInput($('[data-register-faturamento]')?.value)) throw new Error('Informe o faturamento mensal da empresa.');
  if (!Number.isFinite(parsePercentLike($('[data-register-margem]')?.value))) throw new Error('Informe a margem estimada da empresa.');

  const button = $('button[type="submit"]', form);
  setLoading(button, true, 'Criando...');
  try {
    const annualRevenue = annualRevenueFromMonthlyInput($('[data-register-faturamento]')?.value);
    const margin = parsePercentLike($('[data-register-margem]')?.value);
    const empresaPayload = {
      ...(state.cnpjData || {}),
      faturamento: annualRevenue || state.cnpjData?.faturamento,
      monthlyRevenue: annualRevenue ? Math.round(annualRevenue / 12) : undefined,
      margem: Number.isFinite(margin) ? margin : state.cnpjData?.margem
    };

    await apiRequest('/api/auth/register-cnpj', {
      method: 'POST',
      body: JSON.stringify({ cnpj, password, plan, empresa: empresaPayload })
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

async function addCompany(event) {
  event.preventDefault();
  if (!state.token) {
    openModal('[data-login-modal]');
    return;
  }
  const form = event.currentTarget;
  const cnpj = onlyDigits(form.elements.cnpj?.value || form.querySelector('[data-add-cnpj]')?.value || '');
  const nome = (form.elements.nome?.value || '').trim();
  const faturamento = annualRevenueFromMonthlyInput(form.elements.faturamento?.value || '');
  const margem = parsePercentLike(form.elements.margem?.value || '');
  if (cnpj.length !== 14) throw new Error('Informe um CNPJ válido (14 dígitos).');
  if (!faturamento) throw new Error('Informe o faturamento mensal da empresa.');
  if (!Number.isFinite(margem) || margem < 0) throw new Error('Informe a margem estimada da empresa.');

  const button = $('button[type="submit"]', form);
  setLoading(button, true, 'Adicionando...');
  try {
    const payload = {
      cnpj,
      nome,
      faturamento,
      monthlyRevenue: Math.round(faturamento / 12),
      margem
    };
    const data = await apiRequest('/api/companies', { method: 'POST', body: JSON.stringify(payload) });
    const companyId = data?.company?.id || data?.companyId || (data?.company && data.company.id) || null;
    closeModals();
    if (companyId) {
      state.activeCompanyId = companyId;
      localStorage.setItem('finpj_active_company', companyId);
    }
    await loadWorkspaceData({ companyId: companyId || undefined, forceDashboard: true });
    showToast('Empresa adicionada.', 'success');
  } finally {
    setLoading(button, false);
  }
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
        const companyId = activeCompanyId();
        await apiRequest('/api/openfinance/connect', {
          method: 'POST',
          body: JSON.stringify({ itemId, companyId: companyId || undefined })
        });
        await Promise.all([
          loadBanks(companyId),
          loadDashboard({ companyId, force: true })
        ]);
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
    margem,
    companyId: activeCompanyId() || undefined,
    ncm: form.elements.ncm ? form.elements.ncm.value.trim() : ''
  };
  const button = $('button[type="submit"]', form);
  setLoading(button, true, 'Analisando...');
  try {
    const data = await apiRequest('/api/diagnosticos', { method: 'POST', body: JSON.stringify(payload) });
    renderAnalysisResult('[data-diagnostic-result]', data.resultados || data);
    await loadDiagnostics(activeCompanyId());
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
  const tipo = form.elements.tipo.value;
  const contexto = form.elements.contexto.value || '';
  const button = $('button[type="submit"]', form);
  setLoading(button, true, 'Enviando...');
  try {
    const companyId = activeCompanyId();
    let data;
    const useR2 = file.size > 4 * 1024 * 1024;
    if (useR2) {
      try {
        const urlRes = await apiRequest('/api/upload-url', {
          method: 'POST',
          body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, companyId: companyId || undefined })
        });
        if (urlRes.sucesso && urlRes.uploadUrl) {
          setLoading(button, true, 'Enviando para storage...');
          const uploadRes = await fetch(urlRes.uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type }
          });
          if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
          setLoading(button, true, 'Analisando...');
          data = await apiRequest('/api/process-document', {
            method: 'POST',
            body: JSON.stringify({ key: urlRes.key, tipo, contexto, filename: file.name, size: file.size, companyId: companyId || undefined })
          });
        } else {
          throw new Error('R2 not available');
        }
      } catch (r2Err) {
        console.warn('[uploadAiDocument] Falha no upload R2, usando fallback:', r2Err.message);
        setLoading(button, true, 'Analisando (modo compatibilidade)...');
        const body = new FormData();
        body.append('tipo', tipo);
        body.append('contexto', contexto);
        if (companyId) body.append('companyId', companyId);
        body.append('arquivo', file);
        data = await apiRequest('/api/upload-documento', { method: 'POST', body });
      }
    } else {
      setLoading(button, true, 'Analisando...');
      const body = new FormData();
      body.append('tipo', tipo);
      body.append('contexto', contexto);
      if (companyId) body.append('companyId', companyId);
      body.append('arquivo', file);
      data = await apiRequest('/api/upload-documento', { method: 'POST', body });
    }
    renderAnalysisResult('[data-ai-result]', data);
    await loadAnalyses(companyId);
    showToast('Análise concluída.', 'success');
  } finally {
    setLoading(button, false);
  }
}

async function syncBank(bankId) {
  const companyId = activeCompanyId();
  await apiRequest(withCompanyQuery(`/api/openfinance/sync/${encodeURIComponent(bankId)}`, companyId), { method: 'POST' });
  await Promise.all([
    loadBanks(companyId),
    loadDashboard({ companyId, force: true })
  ]);
  showToast('Banco sincronizado.', 'success');
}

async function removeBank(bankId) {
  const companyId = activeCompanyId();
  await apiRequest(withCompanyQuery(`/api/openfinance/banks/${encodeURIComponent(bankId)}`, companyId), { method: 'DELETE' });
  await Promise.all([
    loadBanks(companyId),
    loadDashboard({ companyId, force: true })
  ]);
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
  await apiRequest(withCompanyQuery(`/api/diagnosticos/${encodeURIComponent(id)}`), { method: 'DELETE' });
  await loadDiagnostics(activeCompanyId());
  showToast('Diagnóstico excluído.', 'success');
}

async function saveProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const companyId = activeCompanyId();
  const payload = {
    nome: form.elements.nome.value.trim(),
    fantasia: form.elements.fantasia.value.trim(),
    cnpj: onlyDigits(form.elements.cnpj?.value || ''),
    telefone: form.elements.telefone.value.trim(),
    regime: form.elements.regime?.value || '',
    setor: form.elements.setor?.value.trim() || '',
    faturamento: parseMoneyLike(form.elements.faturamento?.value || ''),
    margem: parsePercentLike(form.elements.margem?.value || '', 0),
    companyId: companyId || undefined
  };
  clearDashboardClientCache(companyId);
  await apiRequest(withCompanyQuery('/api/profile', companyId), { method: 'PUT', body: JSON.stringify(payload) });
  await Promise.all([
    loadProfile(companyId),
    loadDashboard({ companyId, force: true })
  ]);
  showToast('Perfil salvo.', 'success');
}

function handleAuth0Redirect() {
  let params = new URLSearchParams(window.location.search);
  if (!params.get('token') && window.location.hash.includes('?')) {
    params = new URLSearchParams(window.location.hash.split('?')[1]);
  }
  const token = params.get('token');
  if (!token) return false;
  persistSession(token, params.get('email') || state.authEmail || 'auth0', 'auth0');
  history.replaceState(null, '', '/#dashboard');
  loadWorkspaceData().catch((error) => showToast(error.message, 'error'));
  return true;
}

async function loadWorkspaceData(options = {}) {
  if (!state.token) return;
  showDashboardSkeletons();
  const companyId = options.companyId ?? activeCompanyId();
  const tasks = [
    loadDashboard({ companyId, force: options.forceDashboard }),
    loadBanks(companyId),
    loadProfile(companyId),
    loadAnalyses(companyId),
    loadDiagnostics(companyId),
    loadFiscalCalendar()
  ];
  const results = await Promise.allSettled(tasks);
  const failed = results.find((result) => result.status === 'rejected');
  if (failed) {
    const message = failed.reason?.message || 'Não foi possível carregar todos os dados.';
    setDashboardError(message);
    showToast(message, 'error');
    if (/token|jwt|unauthorized|401/i.test(message)) clearSession();
  }
  renderBusinessDashboards();
}

function bindEvents() {
  window.addEventListener('finpj:session-expired', (event) => {
    if (!state.token) return;
    clearSession();
    showToast(event.detail?.message || 'Sessao expirada. Faca login novamente.', 'error');
  });
  window.addEventListener('popstate', syncPublicRouteModal);
  $('[data-mobile-menu-toggle]')?.addEventListener('click', () => {
    const isOpen = $('[data-mobile-menu]')?.classList.contains('is-open');
    setMobileMenuOpen(!isOpen);
  });
  $$('[data-nav-link]').forEach((link) => link.addEventListener('click', () => closeMobileMenu()));
  $$('[data-open-login]').forEach((button) => button.addEventListener('click', (event) => {
    event.preventDefault();
    openPublicAuthRoute('[data-login-modal]', '/login');
  }));
  $$('[data-open-register]').forEach((button) => button.addEventListener('click', (event) => {
    event.preventDefault();
    openPublicAuthRoute('[data-register-modal]', '/cadastro');
  }));
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModals));
  ['[data-login-modal]', '[data-register-modal]'].forEach((selector) => {
    $(selector)?.addEventListener('close', clearPublicModalRoute);
    $(selector)?.addEventListener('cancel', () => setTimeout(clearPublicModalRoute, 0));
  });
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
    event.target.setAttribute('maxlength', '18');
  });
  $('[data-diagnostic-form]')?.addEventListener('submit', (event) => submitDiagnostic(event).catch((error) => showToast(error.message, 'error')));
  $('[data-ai-upload-form]')?.addEventListener('submit', (event) => uploadAiDocument(event).catch((error) => showToast(error.message, 'error')));
  $('[data-refresh-analyses]')?.addEventListener('click', () => loadAnalyses().catch((error) => showToast(error.message, 'error')));
  $('[data-refresh-diagnostics]')?.addEventListener('click', () => loadDiagnostics().catch((error) => showToast(error.message, 'error')));
  $('[data-public-diagnostic-form]')?.addEventListener('submit', runPublicDiagnostic);
  $('[data-dashboard-tax-form]')?.addEventListener('submit', runDashboardTaxSimulation);
  $('[data-dashboard-tax-form]')?.addEventListener('input', () => runDashboardTaxSimulation());
  $('[data-copy-tax-to-diagnostic]')?.addEventListener('click', copyTaxToDiagnostic);

  const dashboardSearch = $('[data-dashboard-search]');
  const syncDashboardSearch = debounce((event) => {
    const query = event.target.value;
    if (query.trim().length < 3) return;
    const tab = findDashboardTabByQuery(query);
    if (tab) setDashboardTab(tab);
  }, 280);
  dashboardSearch?.addEventListener('input', syncDashboardSearch);
  dashboardSearch?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const tab = findDashboardTabByQuery(event.currentTarget.value);
    if (tab) {
      setDashboardTab(tab);
      showToast(`Seção aberta: ${DASHBOARD_TAB_LABELS[tab]}.`, 'success');
    } else {
      showToast('Nenhuma seção encontrada para essa busca.', 'error');
    }
  });

  $('[data-company-switcher]')?.addEventListener('change', (event) => {
    const companyId = event.currentTarget.value;
    if (!companyId || companyId === state.activeCompanyId) return;
    resetCompanyContext(companyId);
    showDashboardSkeletons();
    loadWorkspaceData({ companyId, forceDashboard: true }).catch((error) => {
      setDashboardError(error.message);
      showToast(error.message, 'error');
    });
  });

  // Simulator form input handlers
  const simulatorCnpjInput = $('[data-cnpj-input]');
  const simulatorFaturamentoInput = $('[data-currency-input]');
  const simulatorMargemInput = $('[data-percent-input]');

  // CNPJ formatting and lookup
  const simulatorCnpjHandler = debounce((cnpj) => {
    if (cnpj.length === 14) {
      lookupCnpjForSimulator(cnpj);
    }
  }, 500);

  simulatorCnpjInput?.addEventListener('input', (event) => {
    const cnpj = onlyDigits(event.target.value);
    event.target.value = formatCnpj(cnpj);
    event.target.setAttribute('maxlength', '18');
    const form = $('[data-public-diagnostic-form]');
    if (form && form.dataset.cnpjLoaded !== cnpj) form.dataset.cnpjLoaded = '';
    if (cnpj.length < 14) {
      const companyInfo = $('[data-company-info]');
      if (companyInfo) companyInfo.style.display = 'none';
      $('[data-company-nome]') && ($('[data-company-nome]').textContent = '');
      $('[data-company-cnae]') && ($('[data-company-cnae]').textContent = '');
      $('[data-company-atividade]') && ($('[data-company-atividade]').textContent = '');
      resetPublicDiagnostic('Digite o CNPJ antes de calcular o melhor regime.', 'Aguardando CNPJ');
    }
    updatePublicSimulatorReadyState();
    simulatorCnpjHandler(cnpj);
  });

  // Currency formatting for faturamento
  simulatorFaturamentoInput?.addEventListener('input', (event) => {
    const value = event.target.value;
    const formatted = formatCurrencyInput(value);
    if (formatted !== value) {
      event.target.value = formatted;
    }
    updatePublicSimulatorReadyState();
    runPublicDiagnostic();
  });

  // Percentage formatting for margem
  simulatorMargemInput?.addEventListener('input', (event) => {
    const value = event.target.value;
    const formatted = formatPercentInput(value);
    if (formatted !== value) {
      event.target.value = formatted;
    }
    updatePublicSimulatorReadyState();
    runPublicDiagnostic();
  });

  // Regime atual change handler
  $('[data-public-diagnostic-form] select[name="regime_atual"]')?.addEventListener('change', runPublicDiagnostic);

  const cnpjInputHandler = debounce((cnpj) => {
    if (cnpj.length !== 14) return;
    lookupCnpj(cnpj).catch((error) => {
      $('[data-cnpj-result]').textContent = error.message || 'Não foi possível consultar este CNPJ agora.';
    });
  }, 450);

  $('[data-register-cnpj]')?.addEventListener('input', (event) => {
    const cnpj = onlyDigits(event.target.value);
    event.target.value = formatCnpj(cnpj);
    event.target.setAttribute('maxlength', '18');
    $('[data-company-preview]').textContent = cnpj.length === 14
      ? `Conta será criada para o CNPJ ${formatCnpj(cnpj)}.`
      : 'Informe o CNPJ para criar a conta.';
    cnpjInputHandler(cnpj);
  });
  ['[data-register-faturamento]', '[data-add-faturamento]'].forEach((selector) => {
    $(selector)?.addEventListener('input', (event) => {
      const formatted = formatCurrencyInput(event.target.value);
      if (formatted !== event.target.value) event.target.value = formatted;
    });
  });
  ['[data-register-margem]', '[data-add-margem]'].forEach((selector) => {
    $(selector)?.addEventListener('input', (event) => {
      const formatted = formatPercentInput(event.target.value);
      if (formatted !== event.target.value) event.target.value = formatted;
    });
  });

  // Add Company modal handlers
  const addCompanyCnpjHandler = debounce((cnpj) => {
    if (cnpj.length !== 14) return;
    lookupAddCompanyCnpj(cnpj).catch((error) => {
      if ($('[data-add-company-preview]')) {
        $('[data-add-company-preview]').textContent = error.message || 'Nao foi possivel consultar este CNPJ agora.';
      }
    });
  }, 450);
  $$('[data-open-add-company]').forEach((button) => button.addEventListener('click', () => {
    if ($('[data-add-company-preview]')) {
      $('[data-add-company-preview]').textContent = 'Digite o CNPJ para buscar os dados publicos da empresa.';
    }
    openModal('[data-add-company-modal]');
  }));
  $('[data-add-company-form]')?.addEventListener('submit', (event) => addCompany(event).catch((error) => showToast(error.message, 'error')));
  $('[data-add-cnpj]')?.addEventListener('input', (event) => {
    const cnpj = onlyDigits(event.target.value);
    event.target.value = formatCnpj(cnpj);
    event.target.setAttribute('maxlength', '18');
    if ($('[data-add-company-preview]') && cnpj.length !== 14) {
      $('[data-add-company-preview]').textContent = 'Digite o CNPJ para buscar os dados publicos da empresa.';
    }
    addCompanyCnpjHandler(cnpj);
  });

  $('[data-login-cnpj]')?.addEventListener('input', (event) => {
    event.target.value = formatCnpj(event.target.value);
    event.target.setAttribute('maxlength', '18');
  });

  $('[data-diag-cnpj]')?.addEventListener('input', (event) => {
    event.target.value = formatCnpj(event.target.value);
    event.target.setAttribute('maxlength', '18');
  });

  $$('[data-theme-toggle]').forEach((button) => button.addEventListener('click', toggleTheme));

  $$('[data-select-plan]').forEach((button) => button.addEventListener('click', () => {
    state.pendingPlan = button.dataset.selectPlan;
    $('[data-register-plan]').value = state.pendingPlan;
    openPublicAuthRoute('[data-register-modal]', '/cadastro');
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

  $$('[data-logout]').forEach((button) => button.addEventListener('click', () => {
    const provider = state.provider;
    clearSession();
    if (provider === 'auth0') window.location.href = '/api/auth/auth0/logout';
    else showToast('Sessão encerrada.', 'success');
  }));

  $('[data-auth-link]')?.addEventListener('click', (event) => {
    if (!state.token) {
      event.preventDefault();
      openModal('[data-login-modal]');
    }
  });
}

function initApp() {
  renderPublicExperience();
  bindEvents();
  initLandingReveal();
  resetPublicDiagnostic();
  updatePublicSimulatorReadyState();
  const handledRedirect = handleAuth0Redirect();
  updateSessionUi();
  syncPublicRouteModal();
  if (state.token && !handledRedirect) {
    loadWorkspaceData().catch((error) => {
      showToast(error.message, 'error');
      if (/token|jwt|unauthorized|401/i.test(error.message)) clearSession();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
