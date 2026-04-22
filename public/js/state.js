export const state = {
  token: localStorage.getItem('finpj_token') || '',
  authEmail: localStorage.getItem('finpj_email') || '',
  provider: localStorage.getItem('finpj_provider') || 'local',
  pendingPlan: 'growth',
  dashboard: null,
  profile: null,
  banks: [],
  openFinanceSummary: null,
  openFinanceTransactions: [],
  cnpjData: null,
  cnpjTimer: null,
  analyses: [],
  diagnostics: [],
  fiscalEvents: []
};

export const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;
