"use client";

import { useState } from "react";
import { Stethoscope } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

export default function DiagnosticsPage() {
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

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiRequest<{ diagnostico: string }>(
        "/api/diagnostics",
        {
          method: "POST",
          body: JSON.stringify(form),
        }
      );
      setResult(data.diagnostico);
    } catch (err: any) {
      setResult(`Erro: ${err.message}`);
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
