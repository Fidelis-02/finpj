"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Calculator } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { maskCurrency, maskPercent, parseCurrencyInput } from "@/lib/utils";

const TaxEngine = require("@/tax/index.js");

export default function TaxPage() {
  const [faturamento, setFaturamento] = useState("");
  const [margem, setMargem] = useState("");
  const [folha, setFolha] = useState("");
  const [atividade, setAtividade] = useState("comercio");
  const [regime, setRegime] = useState("");
  const [result, setResult] = useState<any>(null);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (TaxEngine) {
        const sim = TaxEngine.simulateTaxes({
          annualRevenue: parseCurrencyInput(faturamento),
          margin: parseCurrencyInput(margem) / 100,
          payroll: folha ? parseCurrencyInput(folha) : 0,
          activity: atividade,
        });
        setResult(sim);
      }
    } catch (err) {
      console.error("Simulação falhou:", err);
    }
  };

  const formatBRL = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-8">
      <div>
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <span>FinPJ</span>
          <span>/</span>
          <span className="text-primary font-semibold">Motor Fiscal</span>
        </nav>
        <h1 className="text-3xl font-bold text-primary">Comparador de regimes</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Calculator size={20} className="text-blue-600" />
            </div>
            <h3 className="font-bold text-primary">Parâmetros</h3>
          </div>

          <form onSubmit={handleSimulate} className="space-y-4">
            <Input
              label="Faturamento anual (R$)"
              placeholder="0,00"
              inputMode="numeric"
              value={faturamento}
              onChange={(e) => setFaturamento(maskCurrency(e.target.value))}
            />
            <Input
              label="Margem estimada (%)"
              placeholder="0,00"
              inputMode="numeric"
              value={margem}
              onChange={(e) => setMargem(maskPercent(e.target.value))}
            />
            <Input
              label="Folha de Pagamento Anual (R$)"
              placeholder="0,00"
              inputMode="numeric"
              value={folha}
              onChange={(e) => setFolha(maskCurrency(e.target.value))}
              hint="Impacta INSS Patronal e Fator R"
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Atividade
              </label>
              <select
                value={atividade}
                onChange={(e) => setAtividade(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              >
                <option value="comercio">Comércio</option>
                <option value="servicos">Serviços</option>
                <option value="industria" disabled>
                  Indústria (em breve)
                </option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Regime atual
              </label>
              <select
                value={regime}
                onChange={(e) => setRegime(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              >
                <option value="">Selecione</option>
                <option value="simples">Simples Nacional</option>
                <option value="presumido">Lucro Presumido</option>
                <option value="real">Lucro Real</option>
              </select>
            </div>

            <Button type="submit" className="w-full">
              Comparar regimes
            </Button>
          </form>
        </Card>

        <Card>
          <h3 className="font-bold text-primary mb-4">Resultado estimado</h3>
          {result ? (
            <div className="space-y-4">
              {result.regimes?.map((r: any, i: number) => (
                <motion.div
                  key={r.key}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`p-4 rounded-xl border ${
                    r.key === result.bestRegime?.key
                      ? "bg-green-50 border-green-200"
                      : "bg-gray-50 border-gray-100"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-primary">{r.name}</span>
                    {r.key === result.bestRegime?.key && (
                      <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-1 rounded-full">
                        Melhor opção
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Anual</span>
                      <p className="font-bold">{formatBRL(r.annualTax)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Mensal</span>
                      <p className="font-bold">{formatBRL(r.monthlyTax)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Alíquota efetiva</span>
                      <p className="font-bold">
                        {(r.effectiveRate * 100).toFixed(2)}%
                      </p>
                    </div>
                    {r.savingsComparedToWorst && (
                      <div>
                        <span className="text-gray-500">Economia/mês</span>
                        <p className="font-bold text-green-600">
                          {formatBRL(r.savingsComparedToWorst.monthly)}
                        </p>
                      </div>
                    )}
                  </div>
                  {r.reformaTributaria && (
                    <div className="mt-4 pt-3 border-t border-gray-100/50">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500 flex items-center gap-1">
                          Reforma Tributária (CBS+IBS)
                        </span>
                        <span className="font-bold text-gray-700">
                          {formatBRL(r.reformaTributaria.annualTax)} /ano
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs mt-1">
                        <span className="text-gray-400">Diferença vs Atual:</span>
                        <span className={`font-bold ${r.reformaTributaria.economiaVsAtual > 0 ? "text-green-600" : "text-red-500"}`}>
                          {r.reformaTributaria.economiaVsAtual > 0 ? "Economia de " : "Aumento de "}
                          {formatBRL(Math.abs(r.reformaTributaria.economiaVsAtual))}
                        </span>
                      </div>
                    </div>
                  )}
                  {!r.eligible && (
                    <p className="text-xs text-red-500 mt-2">
                      Não elegível: {r.reason}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Calculator size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-sm">
                Informe faturamento e margem para comparar.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
