"use client";

import React, { useState, useEffect } from "react";
import { Calculator, ArrowRight, ShieldCheck, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { maskCurrency, parseCurrencyInput, maskCNPJ, unmaskCNPJ, isValidCNPJ } from "@/lib/utils";

// Using require since TaxEngine is a CommonJS module
const TaxEngine = require("@/tax/index.js");

interface SimulatorFormProps {
  onRegister: (plan: string, cnpj: string, faturamento: string, email?: string) => void;
  onSubmit?: (data: { cnpj: string; faturamento: string; email: string }) => void;
}

export function SimulatorForm({ onRegister, onSubmit }: SimulatorFormProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [cnpj, setCnpj] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [faturamento, setFaturamento] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  const formatBRL = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = maskCNPJ(e.target.value);
    setCnpj(value);
  };

  // Trigger CNPJ lookup when the input reaches 14 digits (length 18 with mask)
  useEffect(() => {
    const digits = unmaskCNPJ(cnpj);
    if (digits.length === 14) {
      handleCnpjLookup(digits);
    }
  }, [cnpj]);

  const handleCnpjLookup = async (digits: string) => {
    if (!isValidCNPJ(digits)) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/cnpj?cnpj=${digits}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const data = await res.json();
      if (data.nome || data.razao_social) {
        setCompanyName(data.nome || data.razao_social);
        toast.success(`Empresa localizada: ${data.nome || data.razao_social}`);
        setTimeout(() => {
          setStep(2);
          setIsLoading(false);
        }, 600);
      } else {
        throw new Error();
      }
    } catch (err) {
      console.warn("API lookup failed, fallback to mock company name", err);
      setCompanyName("Empresa Exemplo LTDA");
      toast.success("Empresa localizada (Mock)");
      setTimeout(() => {
        setStep(2);
        setIsLoading(false);
      }, 600);
    }
  };

  const handleCnpjBlur = () => {
    const digits = unmaskCNPJ(cnpj);
    if (digits.length > 0 && digits.length < 14) {
      toast.error("CNPJ Inválido", {
        description: "O CNPJ deve conter 14 dígitos.",
      });
    } else if (digits.length === 14 && step === 1 && !isLoading) {
      handleCnpjLookup(digits);
    }
  };

  const handleFaturamentoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFaturamento(maskCurrency(e.target.value));
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!faturamento) {
      toast.error("Faturamento obrigatório");
      return;
    }
    const revenue = parseCurrencyInput(faturamento);
    if (isNaN(revenue) || revenue <= 0) {
      toast.error("Valor inválido", {
        description: "Informe um faturamento válido.",
      });
      return;
    }
    
    setIsLoading(true);
    // Pulse loading state "Analisando NCMs..."
    setTimeout(() => {
      setIsLoading(false);
      setStep(3);
    }, 800);
  };

  const handleStep3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("E-mail corporativo obrigatório");
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("E-mail inválido");
      return;
    }

    // Call handlers
    if (onSubmit) {
      onSubmit({ cnpj, faturamento, email });
    }
    if (onRegister) {
      onRegister("growth", cnpj, faturamento, email);
    }

    try {
      const revenue = parseCurrencyInput(faturamento);
      const sim = TaxEngine.simulateTaxes({
        annualRevenue: revenue,
        margin: 0.15,
        activity: "comercio",
      });
      setSimResult(sim);
      setStep(4);
      toast.success("Diagnóstico gerado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao simular impostos");
    }
  };

  const handleReset = () => {
    setCnpj("");
    setCompanyName("");
    setFaturamento("");
    setEmail("");
    setSimResult(null);
    setStep(1);
  };

  return (
    <div className="w-full text-slate-100 font-sans">
      {/* Step Indicator */}
      {step < 4 && (
        <div className="flex items-center justify-between mb-6 text-xs text-slate-400 font-semibold tracking-wider uppercase">
          <span>Passo {step} de 3</span>
          <div className="flex gap-1.5">
            <span className={`h-1.5 w-6 rounded-full transition-all duration-300 ${step >= 1 ? "bg-blue-500" : "bg-slate-700"}`} />
            <span className={`h-1.5 w-6 rounded-full transition-all duration-300 ${step >= 2 ? "bg-blue-500" : "bg-slate-700"}`} />
            <span className={`h-1.5 w-6 rounded-full transition-all duration-300 ${step >= 3 ? "bg-blue-500" : "bg-slate-700"}`} />
          </div>
        </div>
      )}

      {/* Step 1: CNPJ Input */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="text-left mb-6">
            <h3 className="text-xl font-bold text-white mb-2">Simulador Fiscal PLG</h3>
            <p className="text-sm text-slate-300">
              Descubra em segundos o regime tributário ideal e veja onde você está deixando dinheiro na mesa.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const digits = unmaskCNPJ(cnpj);
              if (digits.length === 14) handleCnpjLookup(digits);
            }}
            className="space-y-4"
            aria-busy={isLoading}
            aria-label="Passo 1: CNPJ"
          >
            <div>
              <label htmlFor="sim-cnpj" className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                CNPJ da Empresa
              </label>
              <div className="relative">
                <input
                  id="sim-cnpj"
                  type="text"
                  inputMode="numeric"
                  maxLength={18}
                  placeholder="00.000.000/0001-00"
                  value={cnpj}
                  onChange={handleCnpjChange}
                  onBlur={handleCnpjBlur}
                  disabled={isLoading}
                  required
                  className="w-full bg-slate-900/60 border border-slate-700/80 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder:text-slate-500 transition-all font-mono"
                  aria-label="CNPJ da empresa"
                  autoComplete="off"
                />
                {isLoading && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading || unmaskCNPJ(cnpj).length !== 14}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
              aria-label="Começar Simulação"
            >
              Começar Simulação
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      )}

      {/* Step 2: Revenue Input */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="text-left mb-6">
            <h3 className="text-xl font-bold text-white mb-1">{companyName || "Sua Empresa"}</h3>
            <p className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 size={12} /> CNPJ validado com sucesso
            </p>
          </div>
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4" aria-label="Carregando análise de NCMs">
              <div className="relative w-16 h-16">
                <span className="absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75 animate-ping" />
                <div className="relative w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white">
                  <Calculator size={28} />
                </div>
              </div>
              <p className="text-sm font-semibold text-blue-400 animate-pulse">Analisando NCMs...</p>
            </div>
          ) : (
            <form onSubmit={handleStep2Submit} className="space-y-4" aria-label="Passo 2: Faturamento">
              <div>
                <label htmlFor="sim-faturamento" className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                  Faturamento Anual
                </label>
                <input
                  id="sim-faturamento"
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={faturamento}
                  onChange={handleFaturamentoChange}
                  required
                  className="w-full bg-slate-900/60 border border-slate-700/80 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder:text-slate-500 transition-all font-mono"
                  aria-label="Faturamento anual da empresa"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                aria-label="Analisar regime tributário"
              >
                Analisar Regime
                <ArrowRight size={16} />
              </button>
            </form>
          )}
        </div>
      )}

      {/* Step 3: Gated Content (Email Capture) */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="text-left mb-6">
            <h3 className="text-xl font-bold text-white mb-2 font-semibold">Análise Concluída</h3>
            <p className="text-sm text-slate-300">
              Encontramos divergências. Insira seu e-mail corporativo para ver o quanto você pode economizar.
            </p>
          </div>
          <form onSubmit={handleStep3Submit} className="space-y-4" aria-label="Passo 3: E-mail Corporativo">
            <div>
              <label htmlFor="sim-email" className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                E-mail Corporativo
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Mail size={18} />
                </span>
                <input
                  id="sim-email"
                  type="email"
                  placeholder="seu@emailcorporativo.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-slate-900/60 border border-slate-700/80 rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder:text-slate-500 transition-all"
                  aria-label="E-mail corporativo"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              aria-label="Ver resultado completo"
            >
              Desbloquear Resultado
              <ShieldCheck size={18} />
            </button>
          </form>
        </div>
      )}

      {/* Step 4: Simulation Results */}
      {step === 4 && simResult && (
        <div className="space-y-6" aria-label="Resultados da simulação">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-2xl font-bold mb-2 text-white">Simulação Concluída</h3>
            <p className="text-slate-300 text-sm">
              O regime tributário mais eficiente para sua empresa é o{" "}
              <strong className="text-emerald-400 font-semibold">{simResult.bestRegime?.name}</strong>.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800/80">
              <span className="text-slate-400 text-sm">Carga Tributária Anual</span>
              <span className="font-bold text-white text-base">{formatBRL(simResult.bestRegime?.annualTax)}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-800/80">
              <span className="text-slate-400 text-sm">Alíquota Efetiva</span>
              <span className="font-bold text-emerald-400">
                {((simResult.bestRegime?.effectiveRate || 0) * 100).toFixed(2)}%
              </span>
            </div>
            {simResult.savingsComparedToWorst?.annual > 0 && (
              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-400 text-sm">Economia Anual Estimada</span>
                <span className="font-extrabold text-emerald-400 text-lg">
                  {formatBRL(simResult.savingsComparedToWorst.annual)}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => onRegister("growth", cnpj, faturamento, email)}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:scale-[1.01]"
            aria-label="Criar conta para ver DRE completo"
          >
            Criar conta para ver DRE completo
          </button>
          
          <button
            onClick={handleReset}
            className="w-full text-slate-400 text-sm hover:text-white transition-colors"
            aria-label="Refazer simulação"
          >
            Refazer simulação
          </button>
        </div>
      )}
    </div>
  );
}
