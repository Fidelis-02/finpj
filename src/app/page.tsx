"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  ShieldCheck,
  Check,
  Star,
  Zap,
  TrendingUp,
  Percent,
} from "lucide-react";
import { Toaster } from "sonner";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { LoginModal } from "@/components/auth/login-modal";
import { RegisterModal } from "@/components/auth/register-modal";
import { SimulatorForm } from "@/components/SimulatorForm";

export default function Home() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("growth");
  const [simCnpj, setSimCnpj] = useState("");
  const [simFaturamento, setSimFaturamento] = useState("");

  const openLogin = () => {
    setRegisterOpen(false);
    setLoginOpen(true);
  };

  const openRegister = (plan?: string, cnpj?: string, faturamento?: string) => {
    if (plan) setSelectedPlan(plan);
    if (cnpj) setSimCnpj(cnpj);
    if (faturamento) setSimFaturamento(faturamento);
    setLoginOpen(false);
    setRegisterOpen(true);
  };

  const socialProofLogos = [
    { name: "TechNova", color: "#3B82F6" },
    { name: "Prisma Corp", color: "#8B5CF6" },
    { name: "Vertex", color: "#10B981" },
    { name: "AltaVia", color: "#F59E0B" },
    { name: "BlueStar", color: "#EC4899" },
  ];

  // SoftwareApplication JSON-LD Schema
  const schemaMarkup = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "FinPJ",
    "operatingSystem": "All",
    "applicationCategory": "BusinessApplication",
    "offers": {
      "@type": "Offer",
      "price": "490.00",
      "priceCurrency": "BRL"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "120"
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-500/30 selection:text-blue-200 overflow-x-hidden">
      {/* JSON-LD Schema markup in body head (Next.js SEO standard) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaMarkup) }}
      />

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

      {/* Navbar */}
      <Navbar onOpenLogin={openLogin} onOpenRegister={() => openRegister()} />

      {/* "Stripe-Style" Hero Section */}
      <section
        id="home"
        className="relative pt-24 pb-20 lg:pt-36 lg:pb-32 overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-950/30 via-slate-950 to-slate-950"
      >
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_at_center,white,transparent_80%)] opacity-35" />
        
        {/* Glowing decorative blobs */}
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-40 left-10 w-80 h-80 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10 flex flex-col lg:flex-row items-center gap-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="flex-1 space-y-8 text-left"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
              <Zap size={14} className="text-blue-400 animate-pulse" />
              Open Finance • Inteligência Fiscal • Cash Flow
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-white">
              Pare de deixar dinheiro na mesa.{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-teal-300">
                O CFO Digital que otimiza seus impostos e controla seu caixa.
              </span>
            </h1>
            
            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl leading-relaxed">
              Conecte sua conta, descubra créditos monofásicos perdidos e simule o regime tributário ideal para empresas que faturam até R$ 20M.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <a href="#simulador">
                <button
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 shadow-lg shadow-blue-500/20"
                  aria-label="Ir para o simulador de regime tributário"
                >
                  Simular Regime <ArrowRight size={20} />
                </button>
              </a>
              <button
                onClick={openLogin}
                className="w-full sm:w-auto border border-slate-700 bg-slate-900/60 text-slate-200 px-8 py-4 rounded-xl font-bold hover:bg-slate-800 hover:text-white transition-all transform hover:-translate-y-0.5"
                aria-label="Acessar sua conta"
              >
                Acessar Conta
              </button>
            </div>

            {/* Micro stats banner */}
            <div className="pt-6 border-t border-slate-800 grid grid-cols-3 gap-6 max-w-md">
              <div>
                <div className="text-2xl font-bold text-white flex items-center gap-1">
                  <Percent size={18} className="text-emerald-400" />
                  -30%
                </div>
                <div className="text-xs text-slate-500">Redução de impostos</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white flex items-center gap-1">
                  <TrendingUp size={18} className="text-blue-400" />
                  100%
                </div>
                <div className="text-xs text-slate-500">Open Finance Integrado</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white flex items-center gap-1">
                  <ShieldCheck size={18} className="text-teal-400" />
                  Zero
                </div>
                <div className="text-xs text-slate-500">Risco tributário</div>
              </div>
            </div>
          </motion.div>

          {/* Hero Premium Interactive Component */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.1 }}
            className="flex-1 relative w-full"
          >
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl shadow-2xl p-8 overflow-hidden relative backdrop-blur-sm">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800/60">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-red-500/80" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <span className="w-3 h-3 rounded-full bg-green-500/80" />
                  <span className="text-xs text-slate-500 font-medium ml-2 font-mono">FINPJ_DASHBOARD</span>
                </div>
                <span className="text-xs font-semibold text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Ao vivo
                </span>
              </div>

              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800">
                  <span className="text-sm font-medium text-slate-400">
                    Saldo projetado a receber (30 dias)
                  </span>
                  <div className="text-4xl font-extrabold text-white mt-1.5 tracking-tight">
                    R$ 142.850,00
                  </div>
                  <div className="text-sm text-emerald-400 font-medium mt-2 flex items-center gap-1">
                    <TrendingUp size={16} /> +18.4% de recuperação de crédito
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950 text-center border border-slate-800/60">
                    <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">
                      Faturamento
                    </span>
                    <div className="font-bold text-white mt-1 text-sm sm:text-base">R$ 128.400</div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 text-center border border-slate-800/60">
                    <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">
                      Créditos NCM
                    </span>
                    <div className="font-bold text-emerald-400 mt-1 text-sm sm:text-base">R$ 19.450</div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 text-center border border-slate-800/60">
                    <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">
                      Divergências
                    </span>
                    <div className="font-bold text-rose-500 mt-1 text-sm sm:text-base">0</div>
                  </div>
                </div>
              </div>

              {/* Dynamic Interactive Decorative Chart */}
              <div className="mt-8 flex items-end gap-2.5 h-28 px-2">
                {[45, 75, 50, 95, 60, 100, 80].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ delay: 0.6 + i * 0.1, duration: 0.6, ease: "easeOut" }}
                      className="w-full bg-gradient-to-t from-blue-600 via-indigo-500 to-cyan-400 rounded-t-md hover:opacity-85 transition-opacity cursor-pointer"
                    />
                    <span className="text-[9px] text-slate-600 font-medium uppercase font-mono">M{i+1}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating micro card */}
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-8 -right-6 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl hidden md:block backdrop-blur-md"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Meta tributária batida</div>
                  <div className="text-[9px] text-emerald-400 font-mono tracking-wider">MARÇO 2026</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-16 border-y border-slate-900 bg-slate-950/40">
        <div className="container mx-auto px-6">
          <p className="text-center text-xs font-bold text-slate-500 uppercase tracking-widest mb-10">
            Empresas que já otimizam seus impostos com o FinPJ
          </p>
          <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16">
            {socialProofLogos.map((logo) => (
              <div
                key={logo.name}
                className="flex items-center gap-2.5 grayscale opacity-45 hover:grayscale-0 hover:opacity-100 transition-all duration-300 cursor-default"
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 32 32"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    width="32"
                    height="32"
                    rx="8"
                    fill={logo.color}
                    fillOpacity="0.15"
                  />
                  <rect
                    x="6"
                    y="6"
                    width="20"
                    height="20"
                    rx="4"
                    fill={logo.color}
                    fillOpacity="0.4"
                  />
                  <rect
                    x="11"
                    y="11"
                    width="10"
                    height="10"
                    rx="2"
                    fill={logo.color}
                  />
                </svg>
                <span className="text-sm font-bold text-slate-400 tracking-tight">
                  {logo.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="recursos" className="bg-slate-950 py-24 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-900/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="container mx-auto px-6 text-center mb-20">
          <span className="text-blue-500 font-bold text-xs uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
            Operação Inteligente
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-5">
            O essencial para decidir rápido e economizar.
          </h2>
        </div>

        <div className="container mx-auto px-6 grid md:grid-cols-3 gap-8">
          {[
            {
              title: "Diagnóstico Fiscal",
              description:
                "Descubra o regime tributário mais eficiente para sua empresa e reduza seus custos com impostos.",
              icon: <ShieldCheck className="text-blue-400" size={24} />,
            },
            {
              title: "Open Finance",
              description:
                "Conecte contas bancárias com segurança e acompanhe seu fluxo de caixa em tempo real.",
              icon: <ArrowRight className="text-blue-400" size={24} />,
            },
            {
              title: "DRE e Indicadores",
              description:
                "Acompanhe a saúde financeira do seu negócio com métricas e painéis atualizados automaticamente.",
              icon: <BarChart3 className="text-blue-400" size={24} />,
            },
          ].map((feature, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -5 }}
              className="p-8 bg-slate-900/50 rounded-2xl border border-slate-800/80 shadow-md hover:border-slate-700/60 hover:shadow-xl transition-all"
            >
              <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Simulator Section */}
      <section id="simulador" className="py-24 container mx-auto px-6">
        <div className="bg-slate-900 border border-slate-800/80 rounded-[3rem] p-10 lg:p-20 text-white overflow-hidden relative">
          <div className="relative z-10 grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-blue-400 font-bold text-xs uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
                Diagnóstico prévio
              </span>
              <h2 className="text-3xl lg:text-4xl font-extrabold mt-6 mb-6 leading-tight">
                Simule o regime mais eficiente para sua empresa.
              </h2>
              <p className="text-slate-400 mb-8 leading-relaxed">
                Informe o CNPJ para buscar dados da empresa de forma automatizada, depois adicione faturamento para comparar regimes.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xs font-bold">
                    1
                  </div>
                  <span className="text-sm text-slate-300">Busca automatizada de CNPJ</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xs font-bold">
                    2
                  </div>
                  <span className="text-sm text-slate-300">Comparativo SN vs LP vs LR</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xs font-bold">
                    3
                  </div>
                  <span className="text-sm text-slate-300">Recuperação monofásica de PIS/COFINS</span>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-950/80 border border-slate-800/80 p-8 rounded-3xl backdrop-blur-md shadow-2xl">
              <SimulatorForm
                onRegister={(plan, cnpj, faturamento, email) =>
                  openRegister(plan, cnpj, faturamento)
                }
              />
            </div>
          </div>
          {/* Abstract background blobs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="py-24 bg-slate-950 border-t border-slate-900">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <span className="text-blue-500 font-bold text-xs uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
              Preços Transparentes
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-5">
              Escolha o ritmo de crescimento da sua empresa.
            </h2>
            <p className="text-slate-400 mt-4 max-w-lg mx-auto text-sm leading-relaxed">
              Todos os planos incluem suporte dedicado, atualizações fiscais diárias e acesso ao motor fiscal completo.
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
                    : "bg-slate-900/40 border border-slate-800 hover:border-slate-700/60 shadow-sm hover:shadow-lg"
                }`}
              >
                <div>
                  {plan.featured && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded-full border border-blue-400/20">
                      <Star size={12} fill="currentColor" /> Mais popular
                    </div>
                  )}
                  <div className="mb-6">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${
                        plan.featured ? "text-blue-400" : "text-slate-400"
                      }`}
                    >
                      {plan.name}
                    </span>
                    <div className="flex items-baseline gap-1 mt-3">
                      <span className="text-4xl font-extrabold text-white">R$ {plan.price}</span>
                      <span className="text-xs text-slate-500">/mês</span>
                    </div>
                    <p className="text-xs mt-3 text-slate-400 leading-relaxed">
                      {plan.description}
                    </p>
                  </div>

                  <ul className="space-y-3.5 mb-8" role="list">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-center gap-3 text-sm text-slate-300">
                        <Check
                          size={16}
                          className={`shrink-0 ${
                            plan.featured ? "text-blue-400" : "text-emerald-400"
                          }`}
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => openRegister(plan.key)}
                  className={`w-full py-4 rounded-xl font-bold transition-all ${
                    plan.featured
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20"
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
