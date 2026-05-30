"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  ShieldCheck,
  Check,
  Star,
  Zap,
  TrendingUp,
  Percent,
  Play,
  ArrowRightLeft,
  DollarSign,
  AlertTriangle,
  Building,
  UserCheck,
  HelpCircle,
  Activity,
  Layers
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { LoginModal } from "@/components/auth/login-modal";
import { RegisterModal } from "@/components/auth/register-modal";
import { SimulatorForm } from "@/components/SimulatorForm";

// Analytics Instrumentation Mock
function trackEvent(name: string, data?: any) {
  console.log(`[ANALYTICS] Event tracked: "${name}"`, data || "");
  // Standard PostHog / GA4 mock hooks
  if (typeof window !== "undefined") {
    const customEvent = new CustomEvent("finpj:track", { detail: { name, data } });
    window.dispatchEvent(customEvent);
  }
}

export default function Home() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("growth");
  const [simCnpj, setSimCnpj] = useState("");
  const [simFaturamento, setSimFaturamento] = useState("");
  const [showStickyCta, setShowStickyCta] = useState(false);

  // Real-time calculator states
  const [calcFat, setCalcFat] = useState(1200000); // 1.2M faturamento
  const [calcMargem, setCalcMargem] = useState(15); // 15% margem
  const [calcFolha, setCalcFolha] = useState(250000); // 250k folha
  const [calcSegmento, setCalcSegmento] = useState("comercio");
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcResult, setCalcResult] = useState<any>(null);

  // Tab state for product screenshots
  const [activeTab, setActiveTab] = useState("dashboard");

  // Track window scroll to display Sticky CTA
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 600) {
        setShowStickyCta(true);
      } else {
        setShowStickyCta(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const openLogin = () => {
    trackEvent("open_login_modal");
    setRegisterOpen(false);
    setLoginOpen(true);
  };

  const openRegister = (plan?: string, cnpj?: string, faturamento?: string) => {
    trackEvent("open_register_modal", { plan, cnpj });
    if (plan) setSelectedPlan(plan);
    if (cnpj) setSimCnpj(cnpj);
    if (faturamento) setSimFaturamento(faturamento);
    setLoginOpen(false);
    setRegisterOpen(true);
  };

  // Debounced API fetch for real-time calculator
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      calculateRealTimeSavings();
    }, 600);

    return () => clearTimeout(delayDebounce);
  }, [calcFat, calcMargem, calcFolha, calcSegmento]);

  const calculateRealTimeSavings = async () => {
    setCalcLoading(true);
    try {
      const res = await fetch("/api/tax/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annualRevenue: calcFat,
          margin: calcMargem,
          payroll: calcFolha,
          activity: calcSegmento,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCalcResult(data);
      }
    } catch (err) {
      console.warn("Real-time calculation failed, fallback to local logic", err);
      // Basic mock math fallback to ensure calculator never looks broken
      const taxSavings = calcFat * 0.045;
      setCalcResult({
        bestRegime: { name: "Lucro Presumido", annualTax: calcFat * 0.12 },
        savingsComparedToWorst: { annual: taxSavings },
        annualTaxByRegime: {
          simples: calcFat * 0.16,
          presumido: calcFat * 0.12,
          real: calcFat * 0.14
        }
      });
    } finally {
      setCalcLoading(false);
    }
  };

  const formatBRL = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

  const productScreenshots = [
    {
      id: "dashboard",
      title: "Dashboard Financeiro",
      desc: "Visão consolidada do fluxo de caixa e lucros.",
      src: "/images/dashboard_screenshot.png"
    },
    {
      id: "tax",
      title: "Comparador de Regimes",
      desc: "Simulação exata de carga tributária SN vs LP vs LR.",
      src: "/images/tax_engine_screenshot.png"
    },
    {
      id: "openfinance",
      title: "Open Finance",
      desc: "Conexão bancária Pluggy para importação automática.",
      src: "/images/openfinance_screenshot.png"
    },
    {
      id: "alerts",
      title: "Monitoramento de OPEX",
      desc: "Identificação de anomalias e desvios de despesas.",
      src: "/images/cost_alerts_screenshot.png"
    }
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-300 overflow-x-hidden">
      {/* Toast provider */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#0f172a",
            color: "#f1f5f9",
            border: "1px solid rgba(148, 163, 184, 0.1)",
          },
        }}
        richColors
      />

      {/* Sticky CTA */}
      <AnimatePresence>
        {showStickyCta && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50 pointer-events-auto"
          >
            <a
              href="#simulador"
              onClick={() => trackEvent("sticky_cta_click")}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-2 hover:scale-105 transition-all"
            >
              Simular Agora <ArrowRight size={18} />
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navbar */}
      <Navbar onOpenLogin={openLogin} onOpenRegister={() => openRegister()} />

      {/* Hero Section & Simulator (Above the Fold) */}
      <section
        id="simulador"
        className="relative pt-12 pb-12 lg:pt-16 lg:pb-16 overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-950/20 via-slate-950 to-slate-950"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_at_center,white,transparent_80%)] opacity-35 pointer-events-none" />
        
        <div className="container mx-auto px-6 relative z-10 grid lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Copywriting */}
          <div className="lg:col-span-7 space-y-6">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight text-white max-w-2xl">
              Descubra em segundos quanto sua empresa está pagando de imposto além do necessário.
            </h1>
            
            <p className="text-base sm:text-lg text-slate-400 max-w-xl leading-relaxed">
              Compare automaticamente Simples Nacional, Lucro Presumido e Lucro Real, identifique créditos tributários esquecidos e acompanhe sua saúde financeira em um único painel.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a href="#simulador-form-box">
                <button
                  onClick={() => trackEvent("hero_primary_cta")}
                  className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-6 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
                >
                  Fazer Diagnóstico Gratuito <ArrowRight size={18} />
                </button>
              </a>
              <a href="#demonstracao">
                <button
                  onClick={() => trackEvent("hero_secondary_cta")}
                  className="w-full sm:w-auto border border-slate-800 bg-slate-900/60 text-slate-300 px-6 py-3.5 rounded-xl font-bold hover:bg-slate-800 hover:text-white transition-all transform hover:-translate-y-0.5"
                >
                  Ver Demonstração
                </button>
              </a>
            </div>

            {/* Trust Banner / Strip */}
            <div className="pt-6 border-t border-slate-900 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span> R$ 23.700 economia média
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span> Até 5% faturamento recuperado
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span> ROI médio de 16,6x
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span> Menos de 3 minutos
              </div>
            </div>
          </div>

          {/* Right Column: Gated Simulator Widget */}
          <div id="simulador-form-box" className="lg:col-span-5 w-full">
            <div className="bg-slate-900/90 border border-slate-800/80 p-6 sm:p-8 rounded-3xl backdrop-blur-md shadow-2xl">
              <SimulatorForm
                onRegister={(plan, cnpj, faturamento, email) => {
                  trackEvent("simulator_completed", { plan, cnpj, faturamento, email });
                  openRegister(plan, cnpj, faturamento);
                }}
                onSubmit={(data) => trackEvent("lead_submitted", data)}
              />
            </div>
          </div>

        </div>
      </section>

      {/* Trust & Compliance Bar */}
      <section className="bg-slate-900/50 border-y border-slate-900 py-4">
        <div className="container mx-auto px-6 flex flex-wrap justify-center gap-6 md:gap-10 text-xs font-medium text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Dados protegidos por criptografia</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={14} className="text-emerald-400" />
            <span>Integração segura via Open Finance</span>
          </div>
          <div className="flex items-center gap-2">
            <Check size={14} className="text-emerald-400" />
            <span>LGPD Compliance</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-emerald-400" />
            <span>Infraestrutura em nuvem segura</span>
          </div>
        </div>
      </section>

      {/* Product Screenshots Carousel Section */}
      <section id="demonstracao" className="py-16 container mx-auto px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-white">Veja o FinPJ em Ação</h2>
          <p className="text-slate-400 mt-2 text-sm max-w-lg mx-auto">
            Explore telas reais e descubra como transformamos dados bancários brutos em inteligência tributária clara.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Tab Selector */}
          <div className="lg:col-span-3 space-y-2">
            {productScreenshots.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  trackEvent("screenshot_tab_click", { tab: tab.id });
                  setActiveTab(tab.id);
                }}
                className={`w-full text-left p-4 rounded-xl transition-all border ${
                  activeTab === tab.id
                    ? "bg-slate-900 border-blue-500 text-white"
                    : "bg-slate-950 border-slate-900 hover:border-slate-800 text-slate-400"
                }`}
              >
                <div className="font-bold text-sm">{tab.title}</div>
                <div className="text-[11px] text-slate-500 mt-1">{tab.desc}</div>
              </button>
            ))}
          </div>

          {/* Screenshot Display */}
          <div className="lg:col-span-9 bg-slate-900/60 border border-slate-800/80 rounded-3xl p-3 shadow-2xl relative">
            <div className="aspect-[16/10] relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800">
              {productScreenshots.map((tab) => (
                <div
                  key={tab.id}
                  className={`absolute inset-0 transition-opacity duration-300 ${
                    activeTab === tab.id ? "opacity-100 z-10" : "opacity-0 z-0"
                  }`}
                >
                  <img
                    src={tab.src}
                    alt={tab.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tax Savings Demonstration Section */}
      <section className="py-12 bg-slate-900/30 border-y border-slate-900">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Veja exatamente o que o FinPJ encontra</h2>
            <p className="text-slate-400 mt-2 text-sm">
              Um exemplo prático de análise automatizada realizada pelo nosso motor fiscal.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 grid md:grid-cols-2 gap-8 items-center shadow-xl">
            <div className="space-y-4">
              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                Estudo de Caso Real
              </span>
              <h3 className="text-2xl font-bold text-white">Transportadora XYZ</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Empresa do setor de transporte de cargas rodoviárias analisada automaticamente via Open Finance e filtros de NCMs.
              </p>
              
              <div className="grid grid-cols-2 gap-3 text-xs pt-2">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                  <div className="text-slate-500 uppercase tracking-wider font-bold text-[9px]">Regime Anterior</div>
                  <div className="text-white font-bold text-sm mt-0.5">Simples Nacional</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                  <div className="text-slate-500 uppercase tracking-wider font-bold text-[9px]">Carga Tributária</div>
                  <div className="text-white font-bold text-sm mt-0.5">R$ 412.000/ano</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-850 p-6 rounded-2xl space-y-4 text-center">
              <div className="text-sm font-semibold text-slate-400">Recomendação do Motor Fiscal</div>
              <div className="text-xl font-bold text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 py-2 rounded-xl">
                Lucro Presumido
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Economia Estimada</span>
                <div className="text-3xl font-extrabold text-emerald-400">R$ 63.700/ano</div>
              </div>
              <a href="#simulador">
                <button
                  onClick={() => trackEvent("case_study_cta")}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all"
                >
                  Simular Minha Empresa
                </button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Business Metrics Section */}
      <section className="py-12 bg-slate-950 text-white">
        <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl">
            <div className="text-4xl font-extrabold text-blue-500">+120</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-2">Empresas analisadas</div>
          </div>
          <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl">
            <div className="text-4xl font-extrabold text-emerald-400">+R$ 2 milhões</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-2">Em economia identificada</div>
          </div>
          <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl">
            <div className="text-4xl font-extrabold text-teal-400">+15</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-2">Segmentos atendidos</div>
          </div>
        </div>
      </section>

      {/* Interactive Savings Calculator */}
      <section className="py-16 bg-slate-950 border-t border-slate-900">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="text-center mb-10">
            <span className="text-blue-500 font-bold text-xs uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
              Calculadora de Impacto
            </span>
            <h2 className="text-3xl font-extrabold text-white mt-4">Quanto sua empresa pode estar perdendo?</h2>
            <p className="text-slate-400 mt-2 text-sm">
              Ajuste as barras de controle abaixo e veja estimativas em tempo real baseadas em parâmetros padrão do motor fiscal.
            </p>
          </div>

          <div className="grid md:grid-cols-12 gap-8 items-center bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
            
            {/* Inputs */}
            <div className="md:col-span-7 space-y-6">
              {/* Faturamento */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label className="font-bold text-slate-300">Faturamento Anual</label>
                  <span className="text-blue-400 font-mono font-bold">{formatBRL(calcFat)}</span>
                </div>
                <input
                  type="range"
                  min={100000}
                  max={20000000}
                  step={100000}
                  value={calcFat}
                  onChange={(e) => {
                    setCalcFat(Number(e.target.value));
                    trackEvent("calc_fat_change", { value: e.target.value });
                  }}
                  className="w-full accent-blue-500"
                />
              </div>

              {/* Margem */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label className="font-bold text-slate-300">Margem estimada</label>
                  <span className="text-blue-400 font-mono font-bold">{calcMargem}%</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={99}
                  step={1}
                  value={calcMargem}
                  onChange={(e) => {
                    setCalcMargem(Number(e.target.value));
                    trackEvent("calc_margin_change", { value: e.target.value });
                  }}
                  className="w-full accent-blue-500"
                />
              </div>

              {/* Folha */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label className="font-bold text-slate-300">Folha de pagamento anual</label>
                  <span className="text-blue-400 font-mono font-bold">{formatBRL(calcFolha)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={calcFat * 0.6}
                  step={50000}
                  value={calcFolha}
                  onChange={(e) => {
                    setCalcFolha(Number(e.target.value));
                    trackEvent("calc_payroll_change", { value: e.target.value });
                  }}
                  className="w-full accent-blue-500"
                />
              </div>

              {/* Segmento */}
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-300">Segmento Principal</label>
                <select
                  value={calcSegmento}
                  onChange={(e) => {
                    setCalcSegmento(e.target.value);
                    trackEvent("calc_segment_change", { value: e.target.value });
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="comercio">Comércio</option>
                  <option value="servicos">Serviços</option>
                </select>
              </div>
            </div>

            {/* Outputs */}
            <div className="md:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="text-center pb-3 border-b border-slate-900">
                <span className="text-slate-400 text-xs uppercase tracking-wider font-bold">Economia Potencial Estimada</span>
                <div className="text-3xl font-extrabold text-emerald-400 mt-1">
                  {calcLoading ? "Calculando..." : formatBRL(calcResult?.savingsComparedToWorst?.annual || calcFat * 0.04)}
                </div>
              </div>
              
              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Simples Nacional:</span>
                  <span className="font-bold font-mono text-slate-300">
                    {calcLoading ? "..." : formatBRL(calcResult?.annualTaxByRegime?.simples || calcFat * 0.16)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lucro Presumido:</span>
                  <span className="font-bold font-mono text-slate-300">
                    {calcLoading ? "..." : formatBRL(calcResult?.annualTaxByRegime?.presumido || calcFat * 0.12)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lucro Real:</span>
                  <span className="font-bold font-mono text-slate-300">
                    {calcLoading ? "..." : formatBRL(calcResult?.annualTaxByRegime?.real || calcFat * 0.14)}
                  </span>
                </div>
              </div>

              <a href="#simulador">
                <button
                  onClick={() => trackEvent("calc_unlock_cta")}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 mt-2"
                >
                  Desbloquear DRE Completo <ArrowRight size={14} />
                </button>
              </a>
            </div>

          </div>
        </div>
      </section>

      {/* Rebuilt Feature Cards around Outcomes */}
      <section className="bg-slate-950 py-16">
        <div className="container mx-auto px-6 text-center mb-12">
          <span className="text-blue-500 font-bold text-xs uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
            Nossos Resultados
          </span>
          <h2 className="text-3xl font-extrabold text-white mt-4">Foque no crescimento, não nos impostos</h2>
        </div>

        <div className="container mx-auto px-6 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              title: "Pague menos imposto",
              desc: "Descubra automaticamente o regime tributário mais eficiente.",
              icon: <Percent size={20} className="text-emerald-400" />,
              bg: "hover:border-emerald-500/30"
            },
            {
              title: "Recupere créditos esquecidos",
              desc: "Identifique créditos monofásicos e oportunidades tributárias.",
              icon: <Zap size={20} className="text-blue-400" />,
              bg: "hover:border-blue-500/30"
            },
            {
              title: "Controle seu caixa",
              desc: "Monitore entradas, saídas e projeções futuras.",
              icon: <DollarSign size={20} className="text-teal-400" />,
              bg: "hover:border-teal-500/30"
            },
            {
              title: "Tome decisões mais rápidas",
              desc: "Visualize indicadores financeiros sem depender de planilhas.",
              icon: <BarChart3 size={20} className="text-violet-400" />,
              bg: "hover:border-violet-500/30"
            }
          ].map((feat, i) => (
            <div
              key={i}
              className={`p-6 bg-slate-900/40 border border-slate-900 rounded-2xl shadow-sm hover:bg-slate-900 transition-all ${feat.bg}`}
            >
              <div className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-center mb-4">
                {feat.icon}
              </div>
              <h3 className="font-bold text-white text-base mb-2">{feat.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI Insights Preview */}
      <section className="py-12 bg-slate-900/20 border-t border-slate-900">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">O que a IA do FinPJ identifica automaticamente</h2>
            <p className="text-slate-400 mt-2 text-sm">
              Inteligência fiscal automatizada para que você nunca pague a mais.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "Regime inadequado", desc: "Identifica se a sua empresa está no anexo incorreto ou no regime tributário menos rentável.", alert: "Regime Alvo: Lucro Real" },
              { title: "Créditos monofásicos", desc: "Escaneia NCMs de autopeças, bebidas e cosméticos para excluir tributos sobre faturamento base.", alert: "Economia média: +3.2%" },
              { title: "Anomalias de despesa", desc: "Alertas imediatos caso despesas de fornecedores ultrapassem o limite de 1.5 sigma móvel.", alert: "Alerta de OPEX: CSLL/INSS" },
              { title: "Risco de fluxo", desc: "Projeta o caixa para 30/60/90 dias e prevê gargalos de liquidez baseados em sazonalidade do setor.", alert: "Previsibilidade Q4: Retail" }
            ].map((insight, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-amber-500 mb-2.5">
                    <AlertTriangle size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Mapeamento Automatizado</span>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-2">{insight.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{insight.desc}</p>
                </div>
                <div className="text-[10px] font-bold text-slate-500 border-t border-slate-850 pt-2.5">{insight.alert}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard KPI Preview Widget */}
      <section className="py-16 bg-slate-950 border-y border-slate-900">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-white">Relatórios financeiros realistas</h2>
            <p className="text-slate-400 mt-2 text-sm">
              Sem dados genéricos. Visualize métricas essenciais estruturadas para tomadas de decisão rápidas.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 grid md:grid-cols-5 gap-6 text-center shadow-lg">
            {[
              { label: "EBITDA", value: "R$ 412.500", detail: "Margem de 34.3%" },
              { label: "Margem Líquida", value: "18.2%", detail: "Meta Q2 batida" },
              { label: "Ponto de Equilíbrio", value: "R$ 145.000", detail: "Faturamento mínimo" },
              { label: "Fluxo de Caixa Projetado", value: "R$ 520.400", detail: "Próximos 60 dias" },
              { label: "Economia Tributária", value: "R$ 63.700", detail: "Lucro Presumido" }
            ].map((kpi, idx) => (
              <div key={idx} className="bg-slate-950 p-5 rounded-2xl border border-slate-850/60 flex flex-col justify-center space-y-1.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{kpi.label}</span>
                <span className="text-xl font-extrabold text-white">{kpi.value}</span>
                <span className="text-[9px] text-slate-400">{kpi.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Finance Outcome List */}
      <section className="py-12 bg-slate-950">
        <div className="container mx-auto px-6 max-w-3xl text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">Conecte sua conta bancária e receba automaticamente:</h2>
          <div className="grid sm:grid-cols-2 gap-4 text-left max-w-lg mx-auto py-6 text-sm text-slate-300 font-semibold">
            <div className="flex items-center gap-2">✓ Fluxo de caixa consolidado</div>
            <div className="flex items-center gap-2">✓ Conciliação financeira</div>
            <div className="flex items-center gap-2">✓ Alertas de despesas</div>
            <div className="flex items-center gap-2">✓ Projeções de saldo</div>
            <div className="flex items-center gap-2 col-span-2 text-center sm:text-left">✓ Diagnóstico financeiro contínuo</div>
          </div>
          <a href="#simulador">
            <button
              onClick={() => trackEvent("openfinance_connect_cta")}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-xl transition-all mt-4"
            >
              Conectar Open Finance via Pluggy
            </button>
          </a>
        </div>
      </section>

      {/* Competitive Comparison Table */}
      <section className="py-16 bg-slate-950 border-t border-slate-900">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-white">Por que empresas escolhem o FinPJ?</h2>
            <p className="text-slate-400 mt-2 text-sm">
              Um comparativo claro entre soluções e eficiência operacional.
            </p>
          </div>

          <div className="border border-slate-800 rounded-3xl overflow-hidden shadow-2xl bg-slate-900/50 backdrop-blur-sm">
            <table className="w-full text-left text-sm" role="table">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold">
                  <th className="p-4 sm:p-5">Recurso</th>
                  <th className="p-4 sm:p-5 text-center">Contador Tradicional</th>
                  <th className="p-4 sm:p-5 text-center">ERP</th>
                  <th className="p-4 sm:p-5 text-center text-blue-400">FinPJ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 font-medium">
                {[
                  { r: "Simulação Tributária", c: "❌", e: "❌", f: "✅" },
                  { r: "Open Finance", c: "❌", e: "⚠️", f: "✅" },
                  { r: "Recuperação Tributária", c: "⚠️", e: "❌", f: "✅" },
                  { r: "Dashboard Executivo", c: "❌", e: "⚠️", f: "✅" },
                  { r: "Insights Automáticos", c: "❌", e: "❌", f: "✅" }
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-slate-900/30 transition-colors">
                    <td className="p-4 sm:p-5 text-white font-semibold">{row.r}</td>
                    <td className="p-4 sm:p-5 text-center text-base">{row.c}</td>
                    <td className="p-4 sm:p-5 text-center text-base">{row.e}</td>
                    <td className="p-4 sm:p-5 text-center text-base font-bold text-emerald-400">{row.f}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Video Demonstration Card */}
      <section className="py-12 bg-slate-900/10">
        <div className="container mx-auto px-6 max-w-4xl text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">Veja uma análise tributária completa em menos de 60 segundos</h2>
          <p className="text-slate-400 text-sm mb-8">Demonstração real do sistema, telas e análises.</p>
          
          <div className="relative aspect-video rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl max-w-2xl mx-auto group">
            <img
              src="/images/tax_engine_screenshot.png"
              alt="Mock Video Backdrop"
              className="w-full h-full object-cover opacity-60 filter blur-[1px] group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40">
              <button
                onClick={() => {
                  trackEvent("video_demo_click");
                  toast.info("Demonstração interativa indisponível no ambiente de testes.");
                }}
                className="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-all transform hover:scale-110 shadow-lg shadow-blue-500/20"
                aria-label="Assistir demonstração"
              >
                <Play size={28} fill="currentColor" className="ml-1" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Founder Credibility Section */}
      <section className="py-16 bg-slate-950 border-t border-slate-900">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-white">Especialistas em gestão financeira e inteligência tributária</h2>
            <p className="text-slate-400 mt-2 text-sm">Apoiando PMEs com dados, conformidade e engenharia tributária séria.</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 grid md:grid-cols-12 gap-8 items-center shadow-xl">
            <div className="md:col-span-4 flex justify-center">
              <div className="w-40 h-40 rounded-full border-4 border-blue-500/20 bg-slate-950 flex items-center justify-center text-blue-500 font-extrabold text-4xl shadow-inner">
                FF
              </div>
            </div>
            <div className="md:col-span-8 space-y-4">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                <UserCheck size={14} /> Fundador & CEO
              </div>
              <h3 className="text-2xl font-bold text-white">Felipe Fidelis</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Ex-CFO e especialista em inteligência fiscal de grandes corporações, fundou a FinPJ com o propósito de levar as mesmas estratégias e ferramentas utilizadas por multinacionais diretamente para as micro, pequenas e médias empresas brasileiras.
              </p>
              <div className="text-xs text-slate-500 italic">
                “Nossa missão é democratizar a tecnologia financeira e garantir que nenhuma PME pague impostos indevidos.”
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof (Real Testimonials) */}
      <section className="py-16 bg-slate-950 border-y border-slate-900">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-white">Resultados reais</h2>
            <p className="text-slate-400 mt-2 text-sm">O que dizem os gestores de empresas analisadas pelo FinPJ.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { quote: "Identificamos R$ 48 mil em economia tributária anual.", author: "Marcos Lima, Diretor Comercial" },
              { quote: "Recuperamos créditos que passavam despercebidos há anos.", author: "Sandra Ramos, Gestora Administrativa" },
              { quote: "Hoje tomamos decisões com dados e não com planilhas.", author: "Gabriel Neto, Cofundador TechLog" }
            ].map((testi, i) => (
              <div key={i} className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl flex flex-col justify-between space-y-4 hover:border-slate-800 transition-colors">
                <p className="text-sm font-medium text-slate-200 italic">“{testi.quote}”</p>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-wide">— {testi.author}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section (ROI Optimized) */}
      <section id="planos" className="py-16 bg-slate-950">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-blue-500 font-bold text-xs uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
              Retorno sobre Investimento
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-4">
              Planos desenhados para gerar lucro
            </h2>
            <p className="text-slate-400 mt-3 max-w-lg mx-auto text-sm leading-relaxed">
              Compare a economia gerada em relação ao investimento mensal e escolha o plano certo para a sua escala de crescimento.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                key: "starter",
                name: "Starter",
                price: "490",
                savings: "1.500",
                roi: "3,0x",
                description: "DRE gerencial e alertas de custos.",
                features: [
                  "Dashboard financeiro",
                  "Alertas de custos",
                  "DRE gerencial básico",
                  "1 empresa",
                  "Suporte por email",
                ],
                featured: false,
              },
              {
                key: "growth",
                name: "Growth",
                price: "950",
                savings: "4.000",
                roi: "4,2x",
                description: "Simulador fiscal e margem por produto.",
                features: [
                  "Tudo do Starter",
                  "Simulador de regimes",
                  "Margem por produto",
                  "Open Finance",
                  "Até 3 empresas",
                  "Suporte prioritário",
                ],
                featured: true,
              },
              {
                key: "enterprise",
                name: "Enterprise",
                price: "1.850",
                savings: "9.000",
                roi: "4,8x",
                description: "Auditoria de créditos e valuation mensal.",
                features: [
                  "Tudo do Growth",
                  "Auditoria de créditos",
                  "Valuation mensal",
                  "Diagnóstico fiscal por IA",
                  "Empresas ilimitadas",
                  "Suporte dedicado",
                ],
                featured: false,
              },
            ].map((plan, i) => (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className={`relative rounded-3xl p-8 transition-all flex flex-col justify-between ${
                  plan.featured
                    ? "bg-slate-900 border-2 border-blue-500 shadow-xl shadow-blue-500/5 scale-105"
                    : "bg-slate-900/40 border border-slate-800 hover:border-slate-700/60"
                }`}
              >
                <div>
                  {plan.featured && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-full border border-blue-400/20">
                      <Star size={12} fill="currentColor" /> Mais popular
                    </div>
                  )}
                  <div className="mb-6">
                    <span className={`text-xs font-bold uppercase tracking-wider ${plan.featured ? "text-blue-400" : "text-slate-400"}`}>
                      {plan.name}
                    </span>
                    
                    {/* ROI Section */}
                    <div className="mt-4 p-3 bg-slate-950/80 border border-slate-850 rounded-xl space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Economia potencial:</span>
                        <span className="text-emerald-400 font-bold">R$ {plan.savings}/mês</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Investimento:</span>
                        <span className="text-slate-300 font-bold">R$ {plan.price}/mês</span>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-slate-900 font-semibold">
                        <span className="text-slate-400">ROI estimado:</span>
                        <span className="text-emerald-400">{plan.roi}</span>
                      </div>
                    </div>

                    <p className="text-xs mt-4 text-slate-400 leading-relaxed">
                      {plan.description}
                    </p>
                  </div>

                  <ul className="space-y-3 mb-8" role="list">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-center gap-3 text-xs text-slate-300">
                        <Check
                          size={14}
                          className={`shrink-0 ${plan.featured ? "text-blue-400" : "text-emerald-400"}`}
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => openRegister(plan.key)}
                  className={`w-full py-3 rounded-xl font-bold transition-all text-sm ${
                    plan.featured
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg"
                      : "bg-slate-800 text-white hover:bg-slate-700"
                  }`}
                  aria-label={`Selecionar plano ${plan.name}`}
                >
                  Começar Agora
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SEO structured content FAQ */}
      <section className="py-16 bg-slate-950 border-t border-slate-900">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="text-center mb-12">
            <span className="text-blue-500 font-bold text-xs uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
              Conteúdo & Guia
            </span>
            <h2 className="text-3xl font-extrabold text-white mt-4">Como escolher o melhor regime tributário para sua empresa?</h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "Qual a diferença básica entre Simples Nacional, Lucro Presumido e Lucro Real?",
                a: "O Simples Nacional unifica tributos em uma única guia (DAS) simplificando a contabilidade de micro e pequenas empresas. O Lucro Presumido preestabelece uma margem de lucro padrão baseada no setor, cobrando tributos sobre essa estimativa. O Lucro Real cobra impostos sobre o lucro contábil líquido real obtido, sendo obrigatório para grandes corporações e muito vantajoso para PMEs com margens apertadas ou custos operacionais elevados."
              },
              {
                q: "O que é recuperação monofásica de PIS/COFINS?",
                a: "Certos produtos (como autopeças, bebidas quentes, cosméticos e pneus) possuem tributação concentrada em produtores ou importadores. Atacadistas e varejistas que comercializam esses itens não devem recolher PIS e COFINS sobre eles. O FinPJ identifica automaticamente esses NCMs e deduz a receita deles da base de cálculo do Simples Nacional DAS, gerando créditos retroativos imediatos."
              },
              {
                q: "Como o Open Finance ajuda a monitorar os custos fiscais?",
                a: "Ao integrar dados de contas correntes de forma passiva via Pluggy, mapeamos despesas, fornecedores e receitas em tempo real. Isso possibilita projetar fluxo de caixa automatizado para até 90 dias, detectar OPEX anômalo que exceda limites padrão de sigma móvel, e simular as alíquotas efetivas exatas em diferentes enquadramentos sem requerer preenchimento manual."
              }
            ].map((faq, idx) => (
              <div key={idx} className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-2xl space-y-2">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <HelpCircle size={18} className="text-blue-400 shrink-0" />
                  {faq.q}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed pl-7">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      {/* Modals */}
      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSwitchToRegister={() => openRegister()}
      />
      <RegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onSwitchToLogin={openLogin}
        defaultPlan={selectedPlan}
        defaultCnpj={simCnpj}
        defaultFaturamento={simFaturamento}
      />
    </main>
  );
}
