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
  ArrowRightLeft,
  DollarSign,
  AlertTriangle,
  Building,
  UserCheck,
  HelpCircle,
  Activity,
  Layers,
  Newspaper,
  ExternalLink,
  ChevronDown,
  Search,
  FileText,
  Link2,
  LayoutDashboard
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

// Reusable fade-in-up animation wrapper
function FadeInSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// FAQ Accordion item
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden transition-colors hover:border-slate-700/80">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left p-6 flex items-start gap-3 cursor-pointer"
        aria-expanded={open}
      >
        <HelpCircle size={18} className="text-blue-400 shrink-0 mt-0.5" />
        <span className="text-base font-bold text-white flex-1">{question}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="shrink-0 text-slate-400"
        >
          <ChevronDown size={18} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="text-sm text-slate-400 leading-relaxed px-6 pb-6 pl-[3.25rem]">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Home() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("growth");
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [news, setNews] = useState<NewsResponse | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState("");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

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

  const openRegister = (plan?: string) => {
    trackEvent("open_register_modal", { plan });
    if (plan) setSelectedPlan(plan);
    setLoginOpen(false);
    setRegisterOpen(true);
  };

  const plans = [
    {
      key: "starter",
      name: "Starter",
      monthlyPrice: 490,
      annualPrice: 4410,
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
      monthlyPrice: 950,
      annualPrice: 8550,
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
      monthlyPrice: 1850,
      annualPrice: 16650,
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
  ];

  const formatPrice = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const howItWorksSteps = [
    {
      step: 1,
      icon: <Search size={24} />,
      title: "Insira seu CNPJ",
      desc: "Identificamos automaticamente os dados da sua empresa via CNPJ — razão social, CNAE, porte e localização.",
    },
    {
      step: 2,
      icon: <FileText size={24} />,
      title: "Receba o diagnóstico fiscal",
      desc: "Simulamos Simples Nacional, Lucro Presumido e Lucro Real com base no seu faturamento real.",
    },
    {
      step: 3,
      icon: <Link2 size={24} />,
      title: "Conecte via Open Finance",
      desc: "Integre sua conta bancária via Pluggy para monitoramento contínuo de fluxo de caixa e despesas.",
    },
    {
      step: 4,
      icon: <LayoutDashboard size={24} />,
      title: "Acompanhe no dashboard",
      desc: "Visualize DRE, margem por produto, alertas de custos e projeções financeiras em tempo real.",
    },
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
              <a
                href="#simulador-form-box"
                onClick={() => trackEvent("hero_primary_cta")}
                className="w-full sm:w-auto bg-blue-500 hover:bg-blue-400 text-white px-6 py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 shadow-lg shadow-blue-950/40"
              >
                Fazer Diagnóstico Gratuito <ArrowRight size={18} />
              </a>
              <a
                href="#como-funciona"
                onClick={() => trackEvent("hero_secondary_cta")}
                className="w-full sm:w-auto border border-white/15 bg-white/5 text-slate-200 px-6 py-3.5 rounded-xl font-semibold hover:bg-white/10 hover:text-white transition-all transform hover:-translate-y-0.5 text-center"
              >
                Ver Como Funciona
              </a>
            </div>

            {/* Trust Banner / Strip */}
            <div className="pt-6 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-medium text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-400" /> Dados criptografados
              </div>
              <div className="flex items-center gap-1.5">
                <ArrowRightLeft size={14} className="text-emerald-400" /> Open Finance via Pluggy
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={14} className="text-emerald-400" /> LGPD Compliance
              </div>
              <div className="flex items-center gap-1.5">
                <Zap size={14} className="text-emerald-400" /> Resultado em segundos
              </div>
            </div>
          </div>

          {/* Right Column: Gated Simulator Widget */}
          <div id="simulador-form-box" className="lg:col-span-5 w-full">
            <div className="bg-white/[0.07] border border-white/15 p-6 sm:p-8 rounded-3xl backdrop-blur-xl shadow-2xl shadow-black/30">
              <SimulatorForm
                onRegister={(plan, cnpj, faturamento, email) => {
                  trackEvent("simulator_completed", { plan, cnpj, faturamento, email });
                  openRegister(plan);
                }}
                onSubmit={(data) => trackEvent("lead_submitted", data)}
              />
            </div>
          </div>

        </div>
      </section>

      {/* How It Works Section */}
      <section id="como-funciona" className="py-20 bg-slate-950 border-b border-slate-900">
        <div className="container mx-auto px-6">
          <FadeInSection className="text-center mb-16">
            <span className="text-blue-500 font-bold text-xs uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
              Como Funciona
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-4">
              Do CNPJ ao dashboard em minutos
            </h2>
            <p className="text-slate-400 mt-3 max-w-lg mx-auto text-sm leading-relaxed">
              Quatro passos para ter visibilidade total sobre a saúde tributária e financeira da sua empresa.
            </p>
          </FadeInSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {howItWorksSteps.map((item, i) => (
              <FadeInSection key={item.step} delay={i * 0.1}>
                <div className="relative p-6 bg-slate-900/40 border border-slate-800 rounded-2xl hover:border-blue-500/30 transition-all group">
                  {/* Step number */}
                  <div className="absolute -top-3 -left-1 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-lg shadow-blue-500/30">
                    {item.step}
                  </div>
                  {/* Connector line */}
                  {i < howItWorksSteps.length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-px bg-gradient-to-r from-slate-700 to-transparent" />
                  )}
                  <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-4 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                    {item.icon}
                  </div>
                  <h3 className="font-bold text-white text-base mb-2">{item.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* News Section */}
      <section id="noticias" className="py-12 container mx-auto px-6">
        <FadeInSection>
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
        </FadeInSection>

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
              <FadeInSection key={item.url}>
                <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 hover:border-blue-400/50 transition-colors">
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
              </FadeInSection>
            ))}
          </div>
        )}
      </section>

      {/* Rebuilt Feature Cards around Outcomes */}
      <section id="resultados" className="bg-slate-950 py-16">
        <div className="container mx-auto px-6 text-center mb-12">
          <FadeInSection>
            <span className="text-blue-500 font-bold text-xs uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
              Nossos Resultados
            </span>
            <h2 className="text-3xl font-extrabold text-white mt-4">Foque no crescimento, não nos impostos</h2>
          </FadeInSection>
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
            <FadeInSection key={i} delay={i * 0.08}>
              <div
                className={`p-6 bg-slate-900/40 border border-slate-900 rounded-2xl shadow-sm hover:bg-slate-900 transition-all ${feat.bg}`}
              >
                <div className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-center mb-4">
                  {feat.icon}
                </div>
                <h3 className="font-bold text-white text-base mb-2">{feat.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
              </div>
            </FadeInSection>
          ))}
        </div>
      </section>

      {/* Open Finance Section — Enhanced */}
      <section className="py-16 bg-slate-950 border-t border-slate-900">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <FadeInSection>
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                  <ArrowRightLeft size={14} /> Integração via Pluggy
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Conecte sua conta bancária e receba automaticamente:
                </h2>
                <div className="space-y-3">
                  {[
                    "Fluxo de caixa consolidado",
                    "Conciliação financeira automática",
                    "Alertas de despesas anômalas",
                    "Projeções de saldo para até 90 dias",
                    "Diagnóstico financeiro contínuo",
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-sm text-slate-300 font-medium">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <Check size={12} className="text-emerald-400" />
                      </div>
                      {item}
                    </div>
                  ))}
                </div>
                <a
                  href="#simulador"
                  onClick={() => trackEvent("openfinance_connect_cta")}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/10 mt-2"
                >
                  Conectar Open Finance <ArrowRight size={16} />
                </a>
              </div>
            </FadeInSection>

            {/* Visual: Simplified flow diagram */}
            <FadeInSection delay={0.15}>
              <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-8 space-y-4">
                {[
                  { label: "Conta Bancária", sublabel: "Dados protegidos via Pluggy", icon: <Building size={18} /> },
                  { label: "Motor de Análise", sublabel: "Classificação e reconciliação automática", icon: <Activity size={18} /> },
                  { label: "Dashboard FinPJ", sublabel: "Fluxo de caixa, DRE e alertas em tempo real", icon: <LayoutDashboard size={18} /> },
                ].map((node, idx) => (
                  <div key={idx}>
                    <div className="flex items-center gap-4 p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                        {node.icon}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{node.label}</p>
                        <p className="text-xs text-slate-400">{node.sublabel}</p>
                      </div>
                    </div>
                    {idx < 2 && (
                      <div className="flex justify-center py-1">
                        <div className="w-px h-4 bg-gradient-to-b from-blue-500/40 to-transparent" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* Competitive Comparison Table */}
      <section className="py-16 bg-slate-950 border-t border-slate-900">
        <div className="container mx-auto px-6 max-w-4xl">
          <FadeInSection className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-white">Por que empresas escolhem o FinPJ?</h2>
            <p className="text-slate-400 mt-2 text-sm">
              Um comparativo claro entre soluções e eficiência operacional.
            </p>
          </FadeInSection>

          <FadeInSection delay={0.1}>
            <div className="border border-slate-800 rounded-3xl overflow-x-auto shadow-2xl bg-slate-900/50 backdrop-blur-sm">
              <table className="w-full text-left text-sm min-w-[480px]" role="table">
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
          </FadeInSection>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="py-16 bg-slate-950">
        <div className="container mx-auto px-6">
          <FadeInSection className="text-center mb-16">
            <span className="text-blue-500 font-bold text-xs uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
              Planos
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-4">
              Escolha o nível de acompanhamento da sua empresa
            </h2>
            <p className="text-slate-400 mt-3 max-w-lg mx-auto text-sm leading-relaxed">
              Comece com os recursos necessários hoje e evolua conforme seus dados e operações crescem.
            </p>

            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-3 mt-8">
              <span className={`text-sm font-medium ${billingCycle === "monthly" ? "text-white" : "text-slate-500"}`}>
                Mensal
              </span>
              <button
                onClick={() => setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")}
                className={`relative w-12 h-6 rounded-full transition-colors ${billingCycle === "annual" ? "bg-blue-600" : "bg-slate-700"}`}
                aria-label="Alternar entre plano mensal e anual"
              >
                <motion.div
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
                  animate={{ x: billingCycle === "annual" ? 24 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
              <span className={`text-sm font-medium ${billingCycle === "annual" ? "text-white" : "text-slate-500"}`}>
                Anual
              </span>
              {billingCycle === "annual" && (
                <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                  -25%
                </span>
              )}
            </div>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
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
                    
                    {/* Price display */}
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-white">
                        {formatPrice(billingCycle === "monthly" ? plan.monthlyPrice : Math.round(plan.annualPrice / 12))}
                      </span>
                      <span className="text-sm text-slate-400">/mês</span>
                    </div>
                    {billingCycle === "annual" && (
                      <p className="text-xs text-slate-500 mt-1">
                        {formatPrice(plan.annualPrice)}/ano — economia de {formatPrice(plan.monthlyPrice * 12 - plan.annualPrice)}
                      </p>
                    )}

                    <p className="text-xs mt-3 text-slate-400 leading-relaxed">
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

      {/* FAQ Section — Interactive Accordion */}
      <section id="faq" className="py-16 bg-slate-950 border-t border-slate-900">
        <div className="container mx-auto px-6 max-w-4xl">
          <FadeInSection className="text-center mb-12">
            <span className="text-blue-500 font-bold text-xs uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
              Perguntas Frequentes
            </span>
            <h2 className="text-3xl font-extrabold text-white mt-4">Como escolher o melhor regime tributário para sua empresa?</h2>
          </FadeInSection>

          <div className="space-y-3">
            <FadeInSection delay={0}>
              <FaqItem
                question="Qual a diferença básica entre Simples Nacional, Lucro Presumido e Lucro Real?"
                answer="O Simples Nacional unifica tributos em uma única guia (DAS) simplificando a contabilidade de micro e pequenas empresas. O Lucro Presumido preestabelece uma margem de lucro padrão baseada no setor, cobrando tributos sobre essa estimativa. O Lucro Real cobra impostos sobre o lucro contábil líquido real obtido, sendo obrigatório para grandes corporações e muito vantajoso para PMEs com margens apertadas ou custos operacionais elevados."
              />
            </FadeInSection>
            <FadeInSection delay={0.05}>
              <FaqItem
                question="O que é recuperação monofásica de PIS/COFINS?"
                answer="Certos produtos (como autopeças, bebidas quentes, cosméticos e pneus) possuem tributação concentrada em produtores ou importadores. Atacadistas e varejistas que comercializam esses itens não devem recolher PIS e COFINS sobre eles. O FinPJ identifica automaticamente esses NCMs e deduz a receita deles da base de cálculo do Simples Nacional DAS, gerando créditos retroativos imediatos."
              />
            </FadeInSection>
            <FadeInSection delay={0.1}>
              <FaqItem
                question="Como o Open Finance ajuda a monitorar os custos fiscais?"
                answer="Ao integrar dados de contas correntes de forma passiva via Pluggy, mapeamos despesas, fornecedores e receitas em tempo real. Isso possibilita projetar fluxo de caixa automatizado para até 90 dias, detectar OPEX anômalo que exceda limites padrão de sigma móvel, e simular as alíquotas efetivas exatas em diferentes enquadramentos sem requerer preenchimento manual."
              />
            </FadeInSection>
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
      />
    </main>
  );
}
