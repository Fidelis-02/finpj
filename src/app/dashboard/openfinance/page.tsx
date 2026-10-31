"use client";

import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

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

export default function OpenFinancePage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.pluggy.ai/pluggy-connect/v2.7.0/pluggy-connect.js";
    script.async = true;
    document.head.appendChild(script);
    return () => script.remove();
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await apiRequest<{ token: string }>("/api/openfinance/token");
      if (!data.token || !window.PluggyConnect) {
        throw new Error("Não foi possível iniciar a conexão bancária.");
      }
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
                body: JSON.stringify({ itemId }),
              });
              setMessage("Banco conectado com sucesso.");
            } catch (connectError) {
              setError(connectError instanceof Error ? connectError.message : "Falha ao salvar o banco conectado.");
            }
          })();
        },
        onError: (connectError) => {
          setError(connectError.message || "Falha ao conectar o banco.");
        },
      });
      pluggy.init();
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Falha ao iniciar conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <span>FinPJ</span><span>/</span>
          <span className="text-primary font-semibold">Open Finance</span>
        </nav>
        <h1 className="text-3xl font-bold text-primary">Open Finance</h1>
      </div>

      <Card className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1">
          <h3 className="font-bold text-primary text-lg mb-2">Conectar banco</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            Conecte sua conta empresarial para importar movimentações e melhorar as análises financeiras.
          </p>
        </div>
        <Button onClick={handleConnect} disabled={loading}>
          <Landmark size={16} /> Conectar banco
        </Button>
      </Card>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-bold text-primary mb-4">Sinais fiscais bancários</h3>
          <div className="text-center py-12 text-gray-400">
            <Landmark size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm">Conecte um banco para ver sinais fiscais.</p>
          </div>
        </Card>
        <Card>
          <h3 className="font-bold text-primary mb-4">Últimos lançamentos</h3>
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">Transações aparecerão após a conexão bancária.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
