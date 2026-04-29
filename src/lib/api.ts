const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const HTTP_MESSAGES: Record<number, string> = {
  400: "Dados inválidos. Verifique as informações enviadas.",
  401: "Sessão expirada. Faça login novamente.",
  403: "Você não tem permissão para acessar este recurso.",
  404: "Recurso não encontrado.",
  409: "Conflito: recurso já existe ou está em uso.",
  422: "Dados incompletos ou fora do formato esperado.",
  429: "Muitas requisições. Aguarde um momento.",
  500: "Erro interno no servidor. Tente novamente mais tarde.",
  502: "Serviço temporariamente indisponível.",
  503: "Serviço em manutenção. Tente novamente em breve.",
};

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("finpj_token") || "";
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error(
      "Sem conexão com a internet. Verifique sua rede e tente novamente."
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const raw =
      typeof body === "object"
        ? body.erro || body.error || body.mensagem || body.message
        : body;
    const friendly = HTTP_MESSAGES[response.status] || `Erro ${response.status}`;

    if (response.status === 401 && token) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("finpj:session-expired", {
            detail: { message: raw || friendly },
          })
        );
      }
    }
    throw new Error(raw || friendly);
  }

  return body as T;
}
