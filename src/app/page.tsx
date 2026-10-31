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
  Layers,
  Newspaper,
  ExternalLink
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { LoginModal } from "@/components/auth/login-modal";
import { RegisterModal } from "@/components/auth/register-modal";
import { SimulatorForm } from "@/components/SimulatorForm";
import { apiRequest } from "@/lib/api";

interface NewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string | null;
  category: string;
  relevance: number;
  opportunity: string;
  cta: string;
  href: string;
}

interface NewsResponse {
  generatedAt: string;
  items: NewsItem[];
  sourceCount: number;
  warnings: Array<{ source: string; message: string }>;
}

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
  const [news, setNews] = useState<NewsResponse | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState("");

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

  useEffect(() => {
    let active = true;
    apiRequest<{ news: NewsResponse }>("/api/news")
      .then((response) => {
        if (active) {
          setNews(response.news);
          setNewsError("");
        }
      })
      .catch((error) => {
        if (active) setNewsError(error instanceof Error ? error.message : "Notícias indisponíveis no momento.");
      })
      .finally(() => {
        if (active) setNewsLoading(false);
      });
    return () => {
      active = false;
    };
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
    <main className="min-h-screen bg-[#07111f] text-slate-100 selection:bg-blue-500/30 selection:text-blue-200 overflow-x-hidden">
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
        className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_15%_20%,rgba(37,99,235,0.2),transparent_35%),radial-gradient(circle_at_85%_10%,rgba(14,165,233,0.12),transparent_30%)]"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)] opacity-40 pointer-events-none" />
        
        <div className="container mx-auto px-6 relative z-10 grid lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Copywriting */}
          <div className="lg:col-span-7 space-y-6 py-12 lg:py-24">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-xs font-semibold text-blue-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Inteligência financeira baseada nos seus dados
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.04em] text-white max-w-2xl">
              Descubra em segundos quanto sua empresa está pagando de imposto além do necessário.
            </h1>
            
            <p className="text-base sm:text-lg text-slate-400 max-w-xl leading-relaxed">
              Compare automaticamente Simples Nacional, Lucro Presumido e Lucro Real, identifique créditos tributários esquecidos e acompanhe sua saúde financeira em um único painel.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a href="#simulador-form-box">
                <button
                  onClick={() => trackEvent("hero_primary_cta")}
                  className="w-full sm:w-auto bg-blue-500 hover:bg-blue-400 text-white px-6 py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 shadow-lg shadow-blue-950/40"
                >
                  Fazer Diagnóstico Gratuito <ArrowRight size={18} />
                </button>
              </a>
              <a href="#demonstracao">
                <button
                  onClick={() => trackEvent("hero_secondary_cta")}
                  className="w-full sm:w-auto border border-white/15 bg-white/5 text-slate-200 px-6 py-3.5 rounded-xl font-semibold hover:bg-white/10 hover:text-white transition-all transform hover:-translate-y-0.5"
                >
                  Ver Demonstração
                </button>
              </a>
            </div>

            {/* Trust Banner / Strip */}
            <div className="pt-6 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-medium text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-400" /> Dados protegidos
              </div>
              <div className="flex items-center gap-1.5">
                <ArrowRightLeft size={14} className="text-emerald-400" /> Open Finance
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={14} className="text-emerald-400" /> Simulação fiscal
              </div>
              <div className="flex items-center gap-1.5">
                <Zap size={14} className="text-emerald-400" /> Dados em um painel
              </div>
            </div>
          </div>

          {/* Right Column: Gated Simulator Widget */}
          <div id="simulador-form-box" className="lg:col-span-5 w-full">
            <div className="bg-white/[0.07] border border-white/15 p-6 sm:p-8 rounded-3xl backdrop-blur-xl shadow-2xl shadow-black/30">
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

      <section id="noticias" className="py-12 container mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-blue-300 text-sm font-bold uppercase tracking-wider mb-2">
              <Newspaper size={16} /> Radar de oportunidades
            </div>
            <h2 className="text-3xl font-extrabold text-white">Notícias que podem impactar sua empresa</h2>
            <p className="text-slate-400 mt-2 max-w-2xl">
              Acompanhe fatos recentes sobre tributos, juros, regulação e operações. Cada notícia vem com uma ação prática para transformar contexto em decisão.
            </p>
          </div>
          {news?.generatedAt && (
            <span className="text-xs text-slate-500">
              Atualizado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(news.generatedAt))}
            </span>
          )}
        </div>

        {newsLoading && (
          <div className="grid md:grid-cols-2 gap-5">
            {[1, 2, 4, 5].map((item) => <div key={item} className="h-52 rounded-2xl bg-slate-900 animate-pulse border border-slate-800" />)}
          </div>
        )}
        {!newsLoading && newsError && (
          <div role="alert" className="rounded-2xl border border-amber-900/60 bg-amber-950/30 p-6 text-amber-200">
            {newsError} Tente novamente mais tarde.
          </div>
        )}
        {!newsLoading && !newsError && news && news.items.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-slate-400">
            Nenhuma notícia relevante foi encontrada nas últimas 48 horas.
          </div>
        )}
        {!newsLoading && !newsError && news && news.items.length > 0 && (
          <div className="grid md:grid-cols-2 gap-5">
            {news.items.slice(0, 2).map((item) => (
              <article key={item.url} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 hover:border-blue-400/50 transition-colors">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-300">{item.category}</span>
                  <span className="text-xs text-slate-500">{item.source}</span>
                </div>
                <h3 className="text-lg font-bold text-white leading-snug">{item.title}</h3>
                <p className="text-sm text-slate-400 mt-3 line-clamp-3">{item.summary}</p>
                <div className="mt-5 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.06] p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Oportunidade</p>
                  <p className="text-sm text-cyan-50 mt-1">{item.opportunity}</p>
                  <a href={item.href} className="inline-flex items-center gap-1.5 mt-3 text-sm font-bold text-blue-300 hover:text-blue-200">
                    {item.cta} <ArrowRight size={14} />
                  </a>
                </div>
                <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-4 text-xs text-slate-500 hover:text-slate-300">
                  Ler fonte original <ExternalLink size={12} />
                </a>
              </article>
            ))}
          </div>
        )}
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

      {/* Pricing Section */}
      <section id="planos" className="py-16 bg-slate-950">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-blue-500 font-bold text-xs uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
              Planos
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-4">
              Escolha o nível de acompanhamento da sua empresa
            </h2>
            <p className="text-slate-400 mt-3 max-w-lg mx-auto text-sm leading-relaxed">
              Comece com os recursos necessários hoje e evolua conforme seus dados e operações crescem.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                key: "starter",
                name: "Starter",
                price: "490",
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
