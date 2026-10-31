"use client";

import { useEffect, useState } from "react";
import { Stethoscope } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

export default function DiagnosticsPage() {
  const { activeCompany } = useAuth();
  const [form, setForm] = useState({
    nome: "",
    cnpj: "",
    setor: "",
    regime: "simples",
    faturamento: "",
    margem: "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activeCompany) return;
    setForm({
      nome: activeCompany.nome || "",
      cnpj: activeCompany.cnpj || "",
      setor: activeCompany.setor || "",
      regime: activeCompany.regime || "simples",
      faturamento: activeCompany.faturamento ? String(activeCompany.faturamento) : "",
      margem: activeCompany.margem != null ? String(activeCompany.margem) : "",
    });
  }, [activeCompany]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await apiRequest<{ diagnostico: string }>(
        "/api/diagnosticos",
        {
          method: "POST",
          body: JSON.stringify({ ...form, companyId: activeCompany?.id }),
        }
      );
      setResult(data.diagnostico);
    } catch (err: any) {
      setError(err.message || "Não foi possível gerar o diagnóstico.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <span>FinPJ</span><span>/</span>
          <span className="text-primary font-semibold">Diagnóstico Fiscal</span>
        </nav>
        <h1 className="text-3xl font-bold text-primary">Diagnóstico tributário</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nome da empresa"
              value={form.nome}
              onChange={(e) => handleChange("nome", e.target.value)}
              required
            />
            <Input
              label="CNPJ"
              placeholder="00.000.000/0001-00"
              inputMode="numeric"
              value={form.cnpj}
              onChange={(e) => handleChange("cnpj", e.target.value)}
              required
            />
            <Input
              label="Setor"
              placeholder="Comércio, serviços, indústria"
              value={form.setor}
              onChange={(e) => handleChange("setor", e.target.value)}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Regime atual</label>
              <select
                value={form.regime}
                onChange={(e) => handleChange("regime", e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              >
                <option value="simples">Simples Nacional</option>
                <option value="presumido">Lucro Presumido</option>
                <option value="real">Lucro Real</option>
              </select>
            </div>
            <Input
              label="Faturamento anual (R$)"
              placeholder="480.000,00"
              inputMode="decimal"
              value={form.faturamento}
              onChange={(e) => handleChange("faturamento", e.target.value)}
            />
            <Input
              label="Margem estimada (%)"
              placeholder="12"
              inputMode="decimal"
              value={form.margem}
              onChange={(e) => handleChange("margem", e.target.value)}
            />
            <Button type="submit" className="w-full" loading={loading}>
              Gerar diagnóstico
            </Button>
          </form>
        </Card>

        <Card>
          <h3 className="font-bold text-primary mb-4">Resultado</h3>
          {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {result ? (
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {result}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Stethoscope size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-sm">Preencha os dados para gerar a análise fiscal.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
