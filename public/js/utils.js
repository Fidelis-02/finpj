export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

export function formatPercent(value, digits = 2) {
  const numeric = Number(value) || 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(numeric);
}

export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatCnpj(value) {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function parseMoneyLike(value) {
  const normalized = String(value || '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return Number(normalized) || 0;
}

export function parsePercentLike(value, fallback = NaN) {
  const parsed = Number(String(value || '').replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed > 1 ? parsed / 100 : parsed;
}

export function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('pt-BR');
}

export function formatRegime(value) {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('simples')) return 'Simples Nacional';
  if (raw.includes('presumido')) return 'Lucro Presumido';
  if (raw.includes('real')) return 'Lucro Real';
  return value || 'A definir';
}

export function inferActivity(setor = '') {
  const normalized = String(setor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/comerc|varejo|atacad/.test(normalized)) return 'comercio';
  if (/industr|fabric|manuf/.test(normalized)) return 'industria';
  if (/servic|consult|clin|agenc|software|profission/.test(normalized)) return 'servicos';
  return 'comercio';
}

export function debounce(fn, wait = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); };
}

export function removeSkeletons(container) {
  if (!container) return;
  container.querySelectorAll('.skeleton').forEach((el) => el.classList.remove('skeleton', 'skeleton-text', 'skeleton-title', 'skeleton-card'));
}

export function setLoading(element, isLoading, label = 'Processando...') {
  if (!element) return;
  if (isLoading) {
    if (!element.dataset.label) element.dataset.label = element.textContent;
    element.classList.add('is-loading');
    element.innerHTML = '<span class="btn-spinner"></span>' + escapeHtml(label);
    element.disabled = true;
  } else {
    element.textContent = element.dataset.label || element.textContent;
    element.classList.remove('is-loading');
    element.disabled = false;
  }
}

export function showToast(message, type = 'info') {
  const stack = $('[data-toast-stack]');
  if (!stack) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : type === 'success' ? 'success' : ''}`;
  toast.textContent = message;
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

export function trapFocus(modal) {
  const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  first.focus();
  modal._onKeydown = (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  modal.addEventListener('keydown', modal._onKeydown);
}

export function untrapFocus(modal) {
  if (modal._onKeydown) modal.removeEventListener('keydown', modal._onKeydown);
}
