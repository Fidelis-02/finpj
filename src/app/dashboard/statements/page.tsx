"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileText, RefreshCw, Upload } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

type AnalysisData = {
  resumo?: string;
  alertas?: string[];
  recomendacoes?: string[];
  receita_bruta?: number;
  receita_liquida?: number;
  custos?: number;
  lucro_bruto?: number;
  despesas_operacionais?: number;
  ebitda?: number;
  lucro_liquido?: number;
  margem_bruta_pct?: number;
  margem_liquida_pct?: number;
  ativo_total?: number;
  passivo_total?: number;
  patrimonio_liquido?: number;
  liquidez_corrente?: number;
  endividamento_pct?: number;
  indicadores?: {
    liquidez?: Record<string, number | null>;
    rentabilidade?: Record<string, number | null>;
    estrutura_capital?: Record<string, number | null>;
    eficiencia?: Record<string, number | null>;
    limitacoes?: string[];
  };
};

type Analysis = {
  id: string;
  tipo: "dre" | "balanco" | "extrato" | string;
  nomeArquivo?: string;
  data?: string;
  fonte?: string;
  confianca?: { score: number; flags?: string[] };
  resultado?: AnalysisData;
};

const typeLabels: Record<string, string> = {
  dre: "DRE",
  balanco: "Balanço patrimonial",
  extrato: "Extrato bancário",
};

function formatDate(value?: string) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Data não informada"
    : date.toLocaleDateString("pt-BR", { dateStyle: "medium" });
}

function MetricGroup({ title, values }: { title: string; values: [string, number | null | undefined, boolean?][] }) {
  const visible = values.filter(([, value]) => value != null && Number.isFinite(value));
  if (!visible.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-700">{title}</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {visible.map(([label, value, percent]) => (
          <Kpi key={label} label={label} value={value} percent={percent} />
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value, percent = false }: { label: string; value?: number; percent?: boolean }) {
  if (value == null || !Number.isFinite(value)) return null;
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">
        {percent ? `${value.toFixed(1)}%` : formatCurrency(value)}
      </p>
    </div>
  );
}

export default function StatementsPage() {
  const { activeCompany } = useAuth();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalyses = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = activeCompany?.id
        ? `?companyId=${encodeURIComponent(activeCompany.id)}`
        : "";
      const response = await apiRequest<{ analises?: Analysis[] }>(`/api/analises${query}`);
      const records = response.analises || [];
      setAnalyses(records);
      setSelectedId((current) => records.some((item) => item.id === current) ? current : records[0]?.id || "");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar as análises.");
      setAnalyses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalyses();
  }, [activeCompany?.id]);

  const selected = useMemo(
    () => analyses.find((item) => item.id === selectedId) || null,
    [analyses, selectedId]
  );
  const data = selected?.resultado;

  return (
    <div className="space-y-8">
      <div>
        <nav className="mb-2 flex items-center gap-2 text-sm text-gray-400">
          <span>FinPJ</span><span>/</span>
          <span className="font-semibold text-primary">Demonstrações financeiras</span>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Demonstrações financeiras</h1>
            <p className="mt-1 text-sm text-gray-500">Histórico de documentos processados e indicadores extraídos.</p>
          </div>
          <Button variant="outline" onClick={loadAnalyses} disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Atualizar
          </Button>
        </div>
      </div>

      <Card className="flex flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex-1">
          <h3 className="mb-2 text-lg font-bold text-primary">Ative seus indicadores</h3>
          <p className="text-sm leading-relaxed text-gray-500">
            Envie um novo demonstrativo para complementar o histórico da empresa.
          </p>
        </div>
        <Link href="/dashboard/ai">
          <Button><Upload size={16} /> Enviar documento</Button>
        </Link>
      </Card>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Erro:</strong> {error}
        </div>
      )}

      {!loading && !error && analyses.length === 0 && (
        <Card className="py-12 text-center">
          <FileText size={48} className="mx-auto mb-4 text-gray-300" />
          <h2 className="font-semibold text-gray-700">Nenhuma análise disponível</h2>
          <p className="mt-1 text-sm text-gray-400">Envie um DRE, balanço ou extrato para começar.</p>
        </Card>
      )}

      {analyses.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <Card padding="sm">
            <h2 className="mb-3 font-bold text-primary">Documentos analisados</h2>
            <div className="space-y-2">
              {analyses.map((analysis) => (
                <button
                  type="button"
                  key={analysis.id}
                  onClick={() => setSelectedId(analysis.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedId === analysis.id
                      ? "border-blue-300 bg-blue-50"
                      : "border-gray-100 hover:border-blue-200"
                  }`}
                >
                  <p className="truncate text-sm font-semibold text-gray-800">
                    {typeLabels[analysis.tipo] || analysis.tipo}
                  </p>
                  <p className="mt-1 truncate text-xs text-gray-500">{analysis.nomeArquivo || "Arquivo sem nome"}</p>
                  <p className="mt-1 text-xs text-gray-400">{formatDate(analysis.data)}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            {selected && data ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-primary">
                      {typeLabels[selected.tipo] || selected.tipo}
                    </h2>
                    <p className="text-sm text-gray-500">{selected.nomeArquivo || "Arquivo sem nome"} · {formatDate(selected.data)}</p>
                  </div>
                  {selected.confianca && (
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                      Confiança: {Math.round(selected.confianca.score * 100)}%
                    </span>
                  )}
                </div>

                {data.resumo && <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">{data.resumo}</p>}

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <Kpi label="Receita bruta" value={data.receita_bruta} />
                  <Kpi label="Receita líquida" value={data.receita_liquida} />
                  <Kpi label="Custos" value={data.custos} />
                  <Kpi label="Lucro bruto" value={data.lucro_bruto} />
                  <Kpi label="EBITDA" value={data.ebitda} />
                  <Kpi label="Lucro líquido" value={data.lucro_liquido} />
                  <Kpi label="Margem bruta" value={data.margem_bruta_pct} percent />
                  <Kpi label="Margem líquida" value={data.margem_liquida_pct} percent />
                  <Kpi label="Ativo total" value={data.ativo_total} />
                  <Kpi label="Passivo total" value={data.passivo_total} />
                  <Kpi label="Patrimônio líquido" value={data.patrimonio_liquido} />
                  <Kpi label="Liquidez corrente" value={data.liquidez_corrente} />
                  <Kpi label="Endividamento" value={data.endividamento_pct} percent />
                </div>
                {data.indicadores && (
                  <div className="space-y-4">
                    <MetricGroup title="Liquidez" values={[
                      ["Liquidez imediata", data.indicadores.liquidez?.liquidez_imediata],
                      ["Liquidez seca", data.indicadores.liquidez?.liquidez_seca],
                      ["Liquidez geral", data.indicadores.liquidez?.liquidez_geral],
                    ]} />
                    <MetricGroup title="Rentabilidade" values={[
                      ["ROE", data.indicadores.rentabilidade?.roe_pct, true],
                      ["ROA", data.indicadores.rentabilidade?.roa_pct, true],
                    ]} />
                    <MetricGroup title="Estrutura de capital" values={[
                      ["Grau de endividamento", data.indicadores.estrutura_capital?.grau_endividamento],
                      ["Composição do endividamento", data.indicadores.estrutura_capital?.composicao_endividamento_pct, true],
                      ["Capital de giro líquido", data.indicadores.estrutura_capital?.capital_de_giro_liquido],
                    ]} />
                    <MetricGroup title="Eficiência" values={[
                      ["Giro do ativo", data.indicadores.eficiencia?.giro_do_ativo],
                      ["Giro do patrimônio líquido", data.indicadores.eficiencia?.giro_do_pl],
                    ]} />
                    {data.indicadores.limitacoes && data.indicadores.limitacoes.length > 0 && (
                      <p className="text-xs text-gray-500">Indicadores indisponíveis: {data.indicadores.limitacoes.join(" ")}</p>
                    )}
                  </div>
                )}

                {data.alertas && data.alertas.length > 0 && (
                  <div>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <AlertTriangle size={15} className="text-amber-500" /> Pontos críticos
                    </h3>
                    <ul className="space-y-1">
                      {data.alertas.map((alert) => <li key={alert} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{alert}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-gray-400">Esta análise não possui indicadores estruturados.</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
