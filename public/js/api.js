import { state } from './state.js';

const HTTP_MESSAGES = {
  400: 'Dados inválidos. Verifique as informações enviadas.',
  401: 'Sessão expirada. Faça login novamente.',
  403: 'Você não tem permissão para acessar este recurso.',
  404: 'Recurso não encontrado.',
  409: 'Conflito: recurso já existe ou está em uso.',
  422: 'Dados incompletos ou fora do formato esperado.',
  429: 'Muitas requisições. Aguarde um momento.',
  500: 'Erro interno no servidor. Tente novamente mais tarde.',
  502: 'Serviço temporariamente indisponível.',
  503: 'Serviço em manutenção. Tente novamente em breve.'
};

export async function apiRequest(path, options = {}) {
  let response;
  try {
    const headers = { ...(options.headers || {}) };
    if (!(options.body instanceof FormData)) headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    response = await fetch(path, { ...options, headers });
  } catch (networkError) {
    throw new Error('Sem conexão com a internet. Verifique sua rede e tente novamente.');
  }
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const raw = typeof body === 'object' ? (body.erro || body.error || body.mensagem || body.message) : body;
    const friendly = HTTP_MESSAGES[response.status] || `Erro ${response.status}`;
    throw new Error(raw || friendly);
  }
  return body;
}
