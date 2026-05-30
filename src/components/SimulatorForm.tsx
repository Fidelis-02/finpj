"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { toast } from "sonner";
import { maskCurrency, parseCurrencyInput, maskCNPJ, unmaskCNPJ, isValidCNPJ } from "@/lib/utils";
const TaxEngine = require("@/tax/index.js");

interface SimulatorFormProps {
  onRegister: (plan: string, cnpj: string, faturamento: string) => void;
}

export function SimulatorForm({ onRegister }: SimulatorFormProps) {
  const [cnpj, setCnpj] = useState("");
  const [faturamento, setFaturamento] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  const formatBRL = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCnpj(maskCNPJ(e.target.value));
  };

  const handleFaturamentoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFaturamento(maskCurrency(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const rawCnpj = unmaskCNPJ(cnpj);
    if (!isValidCNPJ(rawCnpj)) {
      toast.error("CNPJ Inválido", {
        description: "Verifique o número digitado e tente novamente.",
      });
      return;
    }

    if (!faturamento) {
      toast.error("Faturamento obrigatório", {
        description: "Informe o faturamento anual da empresa.",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Simulate async delay (mimics future API call)
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const revenue = parseCurrencyInput(faturamento);
      if (isNaN(revenue) || revenue <= 0) {
        toast.error("Valor inválido", {
          description: "Informe um faturamento válido.",
        });
        return;
      }

      const sim = TaxEngine.simulateTaxes({
        annualRevenue: revenue,
        margin: 0.15,
        activity: "comercio",
      });

      setSimResult(sim);
      toast.success("Simulação concluída!", {
        description: `Regime mais eficiente: ${sim.bestRegime?.name}`,
      });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao conectar com o motor fiscal", {
        description: "Tente novamente em alguns instantes.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (simResult) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calculator size={32} />
          </div>
          <h3 className="text-2xl font-bold mb-2">Simulação Concluída</h3>
          <p className="text-blue-100/80 text-sm">
            O regime mais eficiente para sua empresa é o{" "}
            <strong className="text-white">{simResult.bestRegime?.name}</strong>.
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-blue-200 text-sm">Carga Tributária Anual</span>
            <span className="font-bold">{formatBRL(simResult.bestRegime?.annualTax)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-blue-200">Alíquota Efetiva</span>
            <span className="font-bold text-green-400">
              {((simResult.bestRegime?.effectiveRate || 0) * 100).toFixed(2)}%
            </span>
          </div>
        </div>
        <button
          onClick={() => onRegister("growth", cnpj, faturamento)}
          className="w-full bg-blue-500 text-white font-bold py-4 rounded-xl hover:bg-blue-600 transition-colors shadow-[0_0_20px_rgba(59,130,246,0.5)]"
          aria-label="Criar conta para ver DRE completo"
        >
          Criar conta para ver DRE completo
        </button>
        <button
          onClick={() => setSimResult(null)}
          className="w-full text-blue-200 text-sm hover:text-white transition-colors"
          aria-label="Refazer simulação"
        >
          Refazer simulação
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      aria-busy={isLoading}
      aria-label="Formulário de simulação tributária"
    >
      <div>
        <label
          htmlFor="sim-cnpj"
          className="text-sm font-medium text-blue-200 block mb-2"
        >
          CNPJ
        </label>
        <input
          id="sim-cnpj"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder:text-white/40"
          placeholder="00.000.000/0001-00"
          value={cnpj}
          onChange={handleCnpjChange}
          inputMode="numeric"
          maxLength={18}
          required
          aria-label="CNPJ da empresa"
          autoComplete="off"
        />
      </div>
      <div>
        <label
          htmlFor="sim-faturamento"
          className="text-sm font-medium text-blue-200 block mb-2"
        >
          Faturamento anual
        </label>
        <input
          id="sim-faturamento"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder:text-white/40"
          placeholder="0,00"
          value={faturamento}
          onChange={handleFaturamentoChange}
          inputMode="numeric"
          required
          aria-label="Faturamento anual da empresa"
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-white text-primary font-bold py-4 rounded-xl mt-4 hover:bg-blue-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        aria-label={isLoading ? "Processando simulação" : "Simular regime tributário"}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin h-5 w-5 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Processando...
          </>
        ) : (
          "Simular regime"
        )}
      </button>
    </form>
  );
}
