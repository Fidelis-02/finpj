"use client";

import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";

export default function SettingsPage() {
  const { activeCompany } = useAuth();
  const [form, setForm] = useState({
    nome: "",
    fantasia: "",
    cnpj: "",
    telefone: "",
    regime: "",
    setor: "",
    faturamento: "",
    margem: "",
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (activeCompany) {
      setForm({
        nome: activeCompany.nome || "",
        fantasia: "",
        cnpj: activeCompany.cnpj || "",
        telefone: "",
        regime: activeCompany.regime || "",
        setor: "",
        faturamento: String(activeCompany.faturamento || ""),
        margem: String(activeCompany.margem || ""),
      });
    }
  }, [activeCompany]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest("/api/user/profile", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setSaved(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <span>FinPJ</span><span>/</span>
          <span className="text-primary font-semibold">Configurações</span>
        </nav>
        <h1 className="text-3xl font-bold text-primary">Dados da empresa</h1>
      </div>

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nome da empresa"
              value={form.nome}
              onChange={(e) => handleChange("nome", e.target.value)}
            />
            <Input
              label="Nome fantasia"
              value={form.fantasia}
              onChange={(e) => handleChange("fantasia", e.target.value)}
            />
            <Input
              label="CNPJ"
              value={form.cnpj}
              onChange={(e) => handleChange("cnpj", e.target.value)}
              inputMode="numeric"
            />
            <Input
              label="Telefone"
              value={form.telefone}
              onChange={(e) => handleChange("telefone", e.target.value)}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Regime tributário</label>
              <select
                value={form.regime}
                onChange={(e) => handleChange("regime", e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              >
                <option value="">Selecione</option>
                <option value="simples">Simples Nacional</option>
                <option value="presumido">Lucro Presumido</option>
                <option value="real">Lucro Real</option>
              </select>
            </div>
            <Input
              label="Setor"
              placeholder="Serviços, comércio, indústria"
              value={form.setor}
              onChange={(e) => handleChange("setor", e.target.value)}
            />
            <Input
              label="Faturamento anual"
              placeholder="Ex.: 480000"
              inputMode="decimal"
              value={form.faturamento}
              onChange={(e) => handleChange("faturamento", e.target.value)}
            />
            <Input
              label="Margem estimada"
              placeholder="Ex.: 0,12"
              inputMode="decimal"
              value={form.margem}
              onChange={(e) => handleChange("margem", e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" loading={loading}>
              <Settings size={16} /> Salvar perfil
            </Button>
            {saved && (
              <span className="text-sm text-green-600 font-medium">
                ✓ Salvo com sucesso
              </span>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
