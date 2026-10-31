"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Lightbulb, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

type Insight = {
  severity: "warning" | "success" | "danger";
  title: string;
  text: string;
  actionTab?: string;
  actionLabel?: string;
};

export default function InsightsPage() {
  const { activeCompany } = useAuth();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInsights = async () => {
    setLoading(true);
    setError("");
    try {
      const query = activeCompany?.id ? `?companyId=${encodeURIComponent(activeCompany.id)}` : "";
      const data = await apiRequest<{ dashboard?: { overview?: { insights?: Insight[] } } }>(`/api/dashboard${query}`);
      setInsights(data.dashboard?.overview?.insights || []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar os insights.");
      setInsights([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, [activeCompany?.id]);

  const styleBySeverity = {
    warning: {
      wrapper: "bg-amber-50/50 border-amber-100",
      icon: <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />,
    },
    success: {
      wrapper: "bg-green-50/50 border-green-100",
      icon: <CheckCircle size={16} className="mt-0.5 shrink-0 text-green-500" />,
    },
    danger: {
      wrapper: "bg-red-50/50 border-red-100",
      icon: <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" />,
    },
  };

  return (
    <div className="space-y-8">
      <div>
        <nav className="mb-2 flex items-center gap-2 text-sm text-gray-400">
          <span>FinPJ</span><span>/</span><span className="font-semibold text-primary">Central de alertas</span>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Central de alertas</h1>
            <p className="mt-1 text-sm text-gray-500">
              Recomendações geradas a partir dos dados disponíveis para {activeCompany?.nome || "a empresa ativa"}.
            </p>
          </div>
          <Button variant="outline" onClick={loadInsights} disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Atualizar
          </Button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading && <Card className="py-12 text-center text-sm text-gray-400">Carregando insights...</Card>}
      {!loading && !error && insights.length === 0 && (
        <Card className="py-12 text-center">
          <Lightbulb size={48} className="mx-auto mb-4 text-gray-300" />
          <h2 className="font-semibold text-gray-700">Nenhum insight disponível</h2>
          <p className="mt-1 text-sm text-gray-400">Conecte um banco ou informe dados financeiros para gerar recomendações.</p>
        </Card>
      )}
      {!loading && insights.length > 0 && (
        <Card>
          <h2 className="mb-4 font-bold text-primary">Recomendações baseadas nos dados</h2>
          <div className="space-y-3">
            {insights.map((insight, index) => {
              const style = styleBySeverity[insight.severity] || styleBySeverity.warning;
              return (
                <div key={`${insight.title}-${index}`} className={`flex items-start gap-3 rounded-xl border p-4 ${style.wrapper}`}>
                  {style.icon}
                  <div>
                    <p className="text-sm font-semibold text-gray-700">{insight.title}</p>
                    <p className="mt-1 text-sm text-gray-600">{insight.text}</p>
                    {insight.actionLabel && <p className="mt-2 text-xs font-medium text-blue-700">Próximo passo: {insight.actionLabel}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
