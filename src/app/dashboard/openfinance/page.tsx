"use client";

import { useCallback, useEffect, useState } from "react";
import { Landmark, RefreshCw, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

declare global {
  interface Window {
    PluggyConnect?: new (options: {
      connectToken: string;
      includeSandbox?: boolean;
      onSuccess: (item: { item?: { id?: string }; itemId?: string; id?: string }) => void;
      onError: (error: { message?: string }) => void;
    }) => { init: () => void };
  }
}

type Bank = {
  bankId: string;
  bankName?: string;
  status?: string;
  lastSync?: string;
  transactions?: unknown[];
};

type Summary = {
  banksCount: number;
  transactionsCount: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  bankBalance: number;
  taxPaid: number;
  lastSync?: string | null;
  categories?: { categoria: string; entradas: number; saidas: number; transacoes: number }[];
};

type Transaction = {
  id?: string;
  data?: string;
  descricao?: string;
  valor?: number;
  tipo?: string;
  bankName?: string;
};

function formatDate(value?: string | null) {
  if (!value) return "Nunca sincronizado";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data indisponível" : date.toLocaleString("pt-BR");
}

export default function OpenFinancePage() {
  const { activeCompany } = useAuth();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBank, setActionBank] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const query = activeCompany?.id ? `?companyId=${encodeURIComponent(activeCompany.id)}` : "";

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [banksResponse, summaryResponse, transactionsResponse] = await Promise.all([
        apiRequest<{ banks?: Bank[] }>(`/api/openfinance/banks${query}`),
        apiRequest<{ summary: Summary }>(`/api/openfinance/summary${query}`),
        apiRequest<{ transactions?: Transaction[] }>(`/api/openfinance/transactions${query ? `${query}&limit=8` : "?limit=8"}`),
      ]);
      setBanks(banksResponse.banks || []);
      setSummary(summaryResponse.summary);
      setTransactions(transactionsResponse.transactions || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os dados bancários.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleConnect = async () => {
    setActionBank("connect");
    setError("");
    setMessage("");
    try {
      const data = await apiRequest<{ token: string }>("/api/openfinance/token");
      if (!data.token || !window.PluggyConnect) throw new Error("Não foi possível iniciar a conexão bancária.");
      const pluggy = new window.PluggyConnect({
        connectToken: data.token,
        includeSandbox: process.env.NODE_ENV !== "production",
        onSuccess: (itemData) => {
          void (async () => {
            try {
              const itemId = itemData.item?.id || itemData.itemId || itemData.id;
              if (!itemId) throw new Error("A Pluggy não retornou o identificador do banco.");
              await apiRequest("/api/openfinance/connect", {
                method: "POST",
                body: JSON.stringify({ itemId, companyId: activeCompany?.id }),
              });
              setMessage("Banco conectado com sucesso.");
              await loadData();
            } catch (connectError) {
              setError(connectError instanceof Error ? connectError.message : "Falha ao salvar o banco conectado.");
            } finally {
              setActionBank("");
            }
          })();
        },
        onError: (connectError) => {
          setError(connectError.message || "Falha ao conectar o banco.");
          setActionBank("");
        },
      });
      pluggy.init();
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Falha ao iniciar conexão.");
      setActionBank("");
    }
  };

  const syncBank = async (bankId: string) => {
    setActionBank(bankId);
    setError("");
    try {
      await apiRequest(`/api/openfinance/sync/${encodeURIComponent(bankId)}`, {
        method: "POST",
        body: JSON.stringify({ companyId: activeCompany?.id }),
      });
      setMessage("Banco sincronizado com sucesso.");
      await loadData();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Falha ao sincronizar o banco.");
    } finally {
      setActionBank("");
    }
  };

  const removeBank = async (bankId: string) => {
    if (!window.confirm("Remover esta conexão bancária?")) return;
    setActionBank(bankId);
    try {
      await apiRequest(`/api/openfinance/banks/${encodeURIComponent(bankId)}?companyId=${encodeURIComponent(activeCompany?.id || "")}`, { method: "DELETE" });
      setMessage("Conexão removida.");
      await loadData();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Falha ao remover a conexão.");
    } finally {
      setActionBank("");
    }
  };

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.pluggy.ai/pluggy-connect/v2.7.0/pluggy-connect.js";
    script.async = true;
    document.head.appendChild(script);
    return () => script.remove();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <nav className="mb-2 flex items-center gap-2 text-sm text-gray-400"><span>FinPJ</span><span>/</span><span className="font-semibold text-primary">Open Finance</span></nav>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-3xl font-bold text-primary">Open Finance</h1><p className="mt-1 text-sm text-gray-500">Conexões e movimentações bancárias reais da empresa.</p></div>
          <Button variant="outline" onClick={loadData} disabled={loading}><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Atualizar</Button>
        </div>
      </div>
      <Card className="flex flex-col items-center justify-between gap-6 md:flex-row">
        <div><h3 className="text-lg font-bold text-primary">Conectar banco</h3><p className="mt-1 text-sm text-gray-500">Importe movimentações por Open Finance para análises financeiras.</p></div>
        <Button onClick={handleConnect} disabled={actionBank === "connect"}><Landmark size={16} /> Conectar banco</Button>
      </Card>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      {summary && summary.banksCount > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Bancos", String(summary.banksCount)],
            ["Transações", String(summary.transactionsCount)],
            ["Entradas", formatCurrency(summary.monthlyIncome)],
            ["Saídas", formatCurrency(summary.monthlyExpenses)],
          ].map(([label, value]) => <Card key={label} padding="sm"><p className="text-xs uppercase text-gray-500">{label}</p><p className="mt-1 text-lg font-bold text-primary">{value}</p></Card>)}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-bold text-primary">Contas conectadas</h3>
          {banks.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Nenhum banco conectado.</p> : <div className="space-y-3">{banks.map((bank) => <div key={bank.bankId} className="rounded-xl border border-gray-100 p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-gray-800">{bank.bankName || "Instituição financeira"}</p><p className="text-xs text-gray-500">Status: {bank.status || "connected"} · {formatDate(bank.lastSync)}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => syncBank(bank.bankId)} disabled={actionBank === bank.bankId}><RefreshCw size={14} /></Button><Button variant="outline" onClick={() => removeBank(bank.bankId)} disabled={actionBank === bank.bankId}><Trash2 size={14} /></Button></div></div></div>)}</div>}
        </Card>
        <Card>
          <h3 className="mb-4 font-bold text-primary">Últimos lançamentos</h3>
          {transactions.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Nenhuma transação real disponível.</p> : <div className="space-y-2">{transactions.map((transaction, index) => <div key={transaction.id || `${transaction.data}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-gray-800">{transaction.descricao || "Lançamento"}</p><p className="text-xs text-gray-400">{transaction.data || "Data não informada"} · {transaction.bankName || "Banco"}</p></div><span className={`whitespace-nowrap text-sm font-semibold ${Number(transaction.valor) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(Number(transaction.valor) || 0)}</span></div>)}</div>}
        </Card>
      </div>
    </div>
  );
}
