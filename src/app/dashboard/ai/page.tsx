"use client";

import { useState, useCallback } from "react";
import { Upload, FileText, AlertTriangle, TrendingUp, CheckCircle, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/utils";

interface AnalysisData {
  receita_bruta?: number;
  deducoes?: number;
  receita_liquida?: number;
  custos?: number;
  lucro_bruto?: number;
  despesas_operacionais?: number;
  ebitda?: number;
  lucro_liquido?: number;
  margem_bruta_pct?: number;
  margem_liquida_pct?: number;
  ativo_total?: number;
  ativo_circulante?: number;
  passivo_total?: number;
  passivo_circulante?: number;
  patrimonio_liquido?: number;
  liquidez_corrente?: number;
  endividamento_pct?: number;
  total_entradas?: number;
  total_saidas?: number;
  saldo_inicial?: number;
  saldo_final?: number;
  num_transacoes?: number;
  alertas?: string[];
  recomendacoes?: string[];
  resumo?: string;
  categorias?: { nome: string; valor: number }[];
  anomalias?: string[];
}

interface AnalysisResponse {
  sucesso?: boolean;
  dados?: AnalysisData;
  fonte?: string;
  confianca?: { score: number; flags?: string[] };
  resultado?: string; // fallback for old format
  nomeArquivo?: string;
}

function ConfidenceBadge({ score, flags }: { score: number; flags?: string[] }) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? "text-emerald-600 bg-emerald-50" : pct >= 40 ? "text-amber-600 bg-amber-50" : "text-red-500 bg-red-50";
  const Icon = pct >= 70 ? CheckCircle : pct >= 40 ? AlertTriangle : XCircle;
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon size={14} />
      Confiança: {pct}%
      {flags && flags.length > 0 && (
        <span className="text-[10px] opacity-70 ml-1">({flags[0]})</span>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-1">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function AIPage() {
  const [tipo, setTipo] = useState("dre");
  const [contexto, setContexto] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((f: File | null) => {
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) {
      setError("O arquivo excede o limite máximo de 50 MB.");
      return;
    }
    setFile(f);
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    handleFile(f || null);
  }, [handleFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const formData = new FormData();
      formData.append("tipo", tipo);
      formData.append("contexto", contexto);
      formData.append("arquivo", file);

      const data = await apiRequest<AnalysisResponse>(
        "/api/upload-documento",
        {
          method: "POST",
          body: formData,
          headers: {},
        }
      );
      setAnalysis(data);
    } catch (err: any) {
      setError(err.message || "Erro ao analisar documento.");
    } finally {
      setLoading(false);
    }
  };

  const dados = analysis?.dados;

  const renderDreKpis = () => {
    if (!dados) return null;
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {dados.receita_bruta != null && <KpiCard label="Receita Bruta" value={formatCurrency(dados.receita_bruta)} />}
        {dados.receita_liquida != null && <KpiCard label="Receita Líquida" value={formatCurrency(dados.receita_liquida)} />}
        {dados.custos != null && <KpiCard label="Custos" value={formatCurrency(dados.custos)} />}
        {dados.lucro_bruto != null && <KpiCard label="Lucro Bruto" value={formatCurrency(dados.lucro_bruto)} />}
        {dados.despesas_operacionais != null && <KpiCard label="Despesas Operacionais" value={formatCurrency(dados.despesas_operacionais)} />}
        {dados.ebitda != null && <KpiCard label="EBITDA" value={formatCurrency(dados.ebitda)} />}
        {dados.lucro_liquido != null && <KpiCard label="Lucro Líquido" value={formatCurrency(dados.lucro_liquido)} />}
        {dados.margem_bruta_pct != null && <KpiCard label="Margem Bruta" value={`${dados.margem_bruta_pct.toFixed(1)}%`} />}
        {dados.margem_liquida_pct != null && <KpiCard label="Margem Líquida" value={`${dados.margem_liquida_pct.toFixed(1)}%`} />}
      </div>
    );
  };

  const renderBalancoKpis = () => {
    if (!dados) return null;
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {dados.ativo_total != null && <KpiCard label="Ativo Total" value={formatCurrency(dados.ativo_total)} />}
        {dados.ativo_circulante != null && <KpiCard label="Ativo Circulante" value={formatCurrency(dados.ativo_circulante)} />}
        {dados.passivo_total != null && <KpiCard label="Passivo Total" value={formatCurrency(dados.passivo_total)} />}
        {dados.passivo_circulante != null && <KpiCard label="Passivo Circulante" value={formatCurrency(dados.passivo_circulante)} />}
        {dados.patrimonio_liquido != null && <KpiCard label="Patrimônio Líquido" value={formatCurrency(dados.patrimonio_liquido)} />}
        {dados.liquidez_corrente != null && <KpiCard label="Liquidez Corrente" value={dados.liquidez_corrente.toFixed(2)} />}
        {dados.endividamento_pct != null && <KpiCard label="Endividamento" value={`${(dados.endividamento_pct * 100).toFixed(1)}%`} />}
      </div>
    );
  };

  const renderExtratoKpis = () => {
    if (!dados) return null;
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {dados.saldo_inicial != null && <KpiCard label="Saldo Inicial" value={formatCurrency(dados.saldo_inicial)} />}
        {dados.saldo_final != null && <KpiCard label="Saldo Final" value={formatCurrency(dados.saldo_final)} />}
        {dados.total_entradas != null && <KpiCard label="Total Entradas" value={formatCurrency(dados.total_entradas)} />}
        {dados.total_saidas != null && <KpiCard label="Total Saídas" value={formatCurrency(dados.total_saidas)} />}
        {dados.num_transacoes != null && <KpiCard label="Transações" value={String(dados.num_transacoes)} />}
      </div>
    );
  };

  const renderKpis = () => {
    if (tipo === "balanco") return renderBalancoKpis();
    if (tipo === "extrato") return renderExtratoKpis();
    return renderDreKpis();
  };

  return (
    <div className="space-y-8">
      <div>
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <span>FinPJ</span><span>/</span>
          <span className="text-primary font-semibold">Analisador DRE</span>
        </nav>
        <h1 className="text-3xl font-bold text-primary">Análise de documentos por IA</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Envie seu DRE, Balanço ou Extrato e receba indicadores financeiros extraídos automaticamente.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Panel */}
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Tipo de documento</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              >
                <option value="dre">DRE (Demonstração do Resultado)</option>
                <option value="balanco">Balanço Patrimonial</option>
                <option value="extrato">Extrato Bancário</option>
              </select>
            </div>

            <Input
              label="Contexto adicional"
              placeholder="Ex.: empresa de serviços, regime Simples Nacional"
              value={contexto}
              onChange={(e) => setContexto(e.target.value)}
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Arquivo (PDF, Excel, CSV, TXT ou imagem)
              </label>
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                  dragOver
                    ? "border-blue-500 bg-blue-50"
                    : file
                    ? "border-emerald-300 bg-emerald-50/50"
                    : "border-gray-200 hover:border-blue-400"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".pdf,.xlsx,.xls,.ods,.csv,.txt,.jpg,.jpeg,.png,.webp,.bmp,.tiff"
                  onChange={(e) => handleFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  {file ? (
                    <>
                      <FileText size={32} className="mx-auto mb-2 text-emerald-500" />
                      <p className="text-sm font-medium text-emerald-700">{file.name}</p>
                      <p className="text-xs text-emerald-500 mt-1">
                        {(file.size / 1024).toFixed(0)} KB — Clique para trocar
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload size={32} className="mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-500">Clique ou arraste o arquivo aqui</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Limite: até 50 MB por arquivo
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>

            <Button type="submit" className="w-full" loading={loading} disabled={!file || loading}>
              {loading ? "Analisando..." : "Analisar documento"}
            </Button>
          </form>
        </Card>

        {/* Results Panel */}
        <Card>
          <h3 className="font-bold text-primary mb-4 flex items-center gap-2">
            <TrendingUp size={18} />
            Resultado da análise
          </h3>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">
              <strong>Erro:</strong> {error}
            </div>
          )}

          {analysis && dados ? (
            <div className="space-y-6">
              {/* Confidence + Source */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                {analysis.confianca && (
                  <ConfidenceBadge score={analysis.confianca.score} flags={analysis.confianca.flags} />
                )}
                {analysis.fonte && (
                  <span className="text-xs text-gray-400">Fonte: {analysis.fonte}</span>
                )}
              </div>

              {/* Summary */}
              {dados.resumo && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900">
                  {dados.resumo}
                </div>
              )}

              {/* KPIs Grid */}
              {renderKpis()}

              {/* Alerts */}
              {dados.alertas && dados.alertas.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-500" /> Alertas
                  </h4>
                  <ul className="space-y-1">
                    {dados.alertas.map((a, i) => (
                      <li key={i} className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {dados.recomendacoes && dados.recomendacoes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <CheckCircle size={14} className="text-emerald-500" /> Recomendações
                  </h4>
                  <ul className="space-y-1">
                    {dados.recomendacoes.map((r, i) => (
                      <li key={i} className="text-sm text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2">
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Anomalies (extrato) */}
              {dados.anomalias && dados.anomalias.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700">Anomalias detectadas</h4>
                  <ul className="space-y-1">
                    {dados.anomalias.map((a, i) => (
                      <li key={i} className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : analysis?.resultado ? (
            // Fallback for plain text result
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {analysis.resultado}
            </div>
          ) : !error ? (
            <div className="text-center py-12 text-gray-400">
              <Upload size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-sm">Envie um documento para exibir a análise.</p>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
