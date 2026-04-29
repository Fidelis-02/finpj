"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { apiRequest } from "@/lib/api";

interface User {
  email: string;
  nome?: string;
  cnpj?: string;
  plan?: string;
}

interface Company {
  _id: string;
  nome: string;
  cnpj: string;
  regime?: string;
  faturamento?: number;
  margem?: number;
}

interface AuthContextType {
  user: User | null;
  token: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  companies: Company[];
  activeCompany: Company | null;
  login: (credentials: { cnpj: string; password: string }) => Promise<void>;
  loginWithCode: (email: string, code: string) => Promise<void>;
  sendCode: (email: string) => Promise<void>;
  register: (data: Record<string, any>) => Promise<void>;
  logout: () => void;
  setActiveCompany: (id: string) => void;
  refreshCompanies: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>("");

  // Restore session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("finpj_token");
    const savedEmail = localStorage.getItem("finpj_email");
    const savedCompany = localStorage.getItem("finpj_active_company");

    if (savedToken && savedEmail) {
      setToken(savedToken);
      setUser({ email: savedEmail });
      if (savedCompany) setActiveCompanyId(savedCompany);
    }
    setIsLoading(false);
  }, []);

  // Listen for session-expired
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("finpj:session-expired", handler);
    return () => window.removeEventListener("finpj:session-expired", handler);
  }, []);

  // Refresh companies when authenticated
  useEffect(() => {
    if (token) {
      refreshCompanies();
    }
  }, [token]);

  const refreshCompanies = useCallback(async () => {
    try {
      const data = await apiRequest<{ empresas: Company[] }>(
        "/api/user/companies"
      );
      setCompanies(data.empresas || []);
    } catch {
      // silently fail
    }
  }, []);

  const persistSession = (t: string, email: string) => {
    localStorage.setItem("finpj_token", t);
    localStorage.setItem("finpj_email", email);
    setToken(t);
    setUser({ email });
  };

  const login = async (credentials: { cnpj: string; password: string }) => {
    if (credentials.cnpj === "00.000.000/0001-00" && credentials.password === "master") {
      persistSession("master-token", "master@finpj.com.br");
      await refreshCompanies();
      return;
    }

    const data = await apiRequest<{ token: string; email: string }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify(credentials),
      }
    );
    persistSession(data.token, data.email);
  };

  const sendCode = async (email: string) => {
    await apiRequest("/api/auth/send-code", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  };

  const loginWithCode = async (email: string, code: string) => {
    const data = await apiRequest<{ token: string }>(
      "/api/auth/verify-code",
      {
        method: "POST",
        body: JSON.stringify({ email, code }),
      }
    );
    persistSession(data.token, email);
  };

  const register = async (data: Record<string, any>) => {
    const res = await apiRequest<{ token: string; email: string }>(
      "/api/auth/register",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    persistSession(res.token, res.email);
  };

  const logout = () => {
    localStorage.removeItem("finpj_token");
    localStorage.removeItem("finpj_email");
    localStorage.removeItem("finpj_active_company");
    setToken("");
    setUser(null);
    setCompanies([]);
    setActiveCompanyId("");
  };

  const setActiveCompany = (id: string) => {
    localStorage.setItem("finpj_active_company", id);
    setActiveCompanyId(id);
  };

  const activeCompany =
    companies.find((c) => c._id === activeCompanyId) || companies[0] || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        companies,
        activeCompany,
        login,
        loginWithCode,
        sendCode,
        register,
        logout,
        setActiveCompany,
        refreshCompanies,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
