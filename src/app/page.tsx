"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  ShieldCheck,
  Check,
  Star,
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

  /* --- Social Proof Logos (placeholder SVGs) --- */
  const socialProofLogos = [
    { name: "TechNova", color: "#3B82F6" },
    { name: "Prisma Corp", color: "#8B5CF6" },
    { name: "Vertex", color: "#10B981" },
    { name: "AltaVia", color: "#F59E0B" },
    { name: "BlueStar", color: "#EC4899" },
  ];

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-300">
      {/* Toast provider */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "var(--background)",
            color: "var(--foreground)",
            border: "1px solid rgba(148, 163, 184, 0.2)",
          },
        }}
        richColors
      />

      {/* Navbar */}
      <Navbar onOpenLogin={openLogin} onOpenRegister={() => openRegister()} />

      {/* Hero Section */}
      <section
        id="home"
        className="container mx-auto px-6 py-20 lg:py-32 flex flex-col lg:flex-row items-center gap-16"
      >
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex-1 space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold uppercase tracking-wider dark:bg-blue-500/10 dark:text-blue-400">
            Open Finance • Impostos • Caixa
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold leading-tight text-primary dark:text-white">
            Controle financeiro PJ com{" "}
            <span className="text-blue-600 dark:text-blue-400">previsibilidade.</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-xl dark:text-slate-400">
            Conecte bancos, acompanhe movimentações e organize indicadores sem
            planilhas quebradas ou etapas desnecessárias.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <a href="#simulador">
              <button
                className="bg-primary text-white px-8 py-4 rounded-full font-semibold flex items-center justify-center gap-2 hover:translate-y-[-2px] transition-all shadow-lg dark:bg-blue-600 dark:hover:bg-blue-700 dark:shadow-blue-600/20"
                aria-label="Ir para o simulador de regime tributário"
              >
                Simular Regime <ArrowRight size={20} />
              </button>
            </a>
            <button
              onClick={openLogin}
              className="border border-gray-200 text-gray-700 px-8 py-4 rounded-full font-semibold hover:bg-gray-50 transition-all dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              aria-label="Acessar sua conta"
            >
              Acessar Conta
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex-1 relative"
        >
          <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100 overflow-hidden relative dark:bg-slate-900 dark:border-white/10 dark:shadow-slate-900/50">
            <div className="flex items-center justify-between mb-8">
              <span className="text-lg font-bold text-gray-800 dark:text-white">
                Visão executiva
              </span>
              <span className="text-sm font-medium text-gray-400 uppercase dark:text-slate-500">
                Hoje
              </span>
            </div>

            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-blue-50/50 border border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20">
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  Saldo projetado
                </span>
                <div className="text-3xl font-bold text-primary mt-1 dark:text-white">
                  R$ 42.800
                </div>
                <div className="text-sm text-green-600 font-medium mt-1 dark:text-green-400">
                  +18% nos próximos 30 dias
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-gray-50 text-center dark:bg-white/5">
                  <span className="text-[10px] uppercase text-gray-400 font-bold dark:text-slate-500">
                    Receitas
                  </span>
                  <div className="font-bold text-gray-800 dark:text-white">R$ 128k</div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 text-center dark:bg-white/5">
                  <span className="text-[10px] uppercase text-gray-400 font-bold dark:text-slate-500">
                    Impostos
                  </span>
                  <div className="font-bold text-gray-800 dark:text-white">R$ 9,4k</div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 text-center dark:bg-white/5">
                  <span className="text-[10px] uppercase text-gray-400 font-bold dark:text-slate-500">
                    Pendências
                  </span>
                  <div className="font-bold text-gray-800 dark:text-white">3</div>
                </div>
              </div>
            </div>

            {/* Decorative bars for chart */}
            <div className="mt-8 flex items-end gap-2 h-24 px-2">
              {[40, 65, 45, 80, 55, 90].map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
                  className="flex-1 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm"
                />
              ))}
            </div>
          </div>

          {/* Floating element */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-6 -right-6 p-4 bg-white rounded-2xl shadow-xl border border-gray-100 hidden md:block dark:bg-slate-800 dark:border-white/10 dark:shadow-slate-900/50"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 dark:bg-green-500/20 dark:text-green-400">
                <BarChart3 size={20} />
              </div>
              <div>
                <div className="text-xs font-bold dark:text-white">Meta batida</div>
                <div className="text-[10px] text-gray-400 dark:text-slate-500">Março 2026</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Social Proof Section */}
      <section className="py-16 border-y border-gray-100 dark:border-white/5">
        <div className="container mx-auto px-6">
          <p className="text-center text-sm font-semibold text-gray-400 uppercase tracking-widest mb-10 dark:text-slate-500">
            Empresas que já otimizam seus impostos com o FinPJ
          </p>
          <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16">
            {socialProofLogos.map((logo) => (
              <div
                key={logo.name}
                className="flex items-center gap-2 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-300 cursor-default"
              >
                <svg
                  width="32"
                  height="32"
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
                <span className="text-sm font-semibold text-gray-500 dark:text-slate-400">
                  {logo.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="recursos" className="bg-gray-50 py-24 dark:bg-slate-900/50">
        <div className="container mx-auto px-6 text-center mb-16">
          <span className="text-blue-600 font-bold text-sm uppercase tracking-widest dark:text-blue-400">
            Operação limpa
          </span>
          <h2 className="text-4xl font-bold text-primary mt-4 dark:text-white">
            O essencial para decidir rápido.
          </h2>
        </div>

        <div className="container mx-auto px-6 grid md:grid-cols-3 gap-8">
          {[
            {
              title: "Diagnóstico Fiscal",
              description:
                "Descubra o regime tributário mais eficiente para sua empresa e reduza seus custos com impostos.",
              icon: <ShieldCheck className="text-blue-600 dark:text-blue-400" size={24} />,
            },
            {
              title: "Open Finance",
              description:
                "Conecte contas bancárias com segurança e acompanhe seu fluxo de caixa em tempo real.",
              icon: <ArrowRight className="text-blue-600 dark:text-blue-400" size={24} />,
            },
            {
              title: "DRE e Indicadores",
              description:
                "Acompanhe a saúde financeira do seu negócio com métricas e painéis atualizados automaticamente.",
              icon: <BarChart3 className="text-blue-600 dark:text-blue-400" size={24} />,
            },
          ].map((feature, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -5 }}
              className="p-8 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all dark:bg-slate-800/50 dark:border-white/5 dark:hover:shadow-slate-900/50"
            >
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 dark:bg-blue-500/10">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-primary mb-3 dark:text-white">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed dark:text-slate-400">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Simulator Section */}
      <section id="simulador" className="py-24 container mx-auto px-6">
        <div className="bg-primary rounded-[3rem] p-12 lg:p-20 text-white overflow-hidden relative dark:bg-slate-900 dark:border dark:border-white/10">
          <div className="relative z-10 grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-blue-400 font-bold text-sm uppercase tracking-widest">
                Diagnóstico prévio
              </span>
              <h2 className="text-4xl lg:text-5xl font-bold mt-4 mb-6">
                Simule o regime mais eficiente.
              </h2>
              <p className="text-lg text-blue-100/80 mb-8">
                Informe o CNPJ para buscar dados da empresa, depois adicione
                faturamento e margem para comparar regimes.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs">
                    1
                  </div>
                  <span>Busca automatizada de CNPJ</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs">
                    2
                  </div>
                  <span>Comparativo SN vs LP vs LR</span>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-xl border border-white/10 p-8 rounded-3xl dark:bg-white/5 dark:border-white/10">
              <SimulatorForm
                onRegister={(plan, cnpj, faturamento) =>
                  openRegister(plan, cnpj, faturamento)
                }
              />
            </div>
          </div>
          {/* Abstract background blobs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-400/10 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="py-24 bg-gray-50 dark:bg-slate-900/50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-blue-600 font-bold text-sm uppercase tracking-widest dark:text-blue-400">
              Planos
            </span>
            <h2 className="text-4xl font-bold text-primary mt-4 dark:text-white">
              Escolha o ritmo da sua empresa.
            </h2>
            <p className="text-gray-500 mt-3 max-w-lg mx-auto dark:text-slate-400">
              Todos os planos incluem suporte, atualizações e acesso ao motor
              fiscal completo.
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
                className={`relative rounded-3xl p-8 transition-all ${
                  plan.featured
                    ? "bg-primary text-white shadow-2xl shadow-primary/20 scale-105 border-2 border-blue-400 dark:bg-blue-600 dark:shadow-blue-600/20 dark:border-blue-500"
                    : "bg-white text-gray-900 border border-gray-100 shadow-sm hover:shadow-xl dark:bg-slate-800/50 dark:text-slate-100 dark:border-white/5 dark:hover:shadow-slate-900/50"
                }`}
              >
                {plan.featured && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-blue-500 text-white text-xs font-bold px-4 py-1.5 rounded-full">
                    <Star size={12} fill="currentColor" /> Mais popular
                  </div>
                )}
                <div className="mb-6">
                  <span
                    className={`text-sm font-bold uppercase tracking-wider ${
                      plan.featured ? "text-blue-300" : "text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {plan.name}
                  </span>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-4xl font-bold">R$ {plan.price}</span>
                    <span
                      className={`text-sm ${
                        plan.featured ? "text-blue-200" : "text-gray-400 dark:text-slate-500"
                      }`}
                    >
                      /mês
                    </span>
                  </div>
                  <p
                    className={`text-sm mt-2 ${
                      plan.featured ? "text-blue-100/80" : "text-gray-500 dark:text-slate-400"
                    }`}
                  >
                    {plan.description}
                  </p>
                </div>

                <ul className="space-y-3 mb-8" role="list">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm">
                      <Check
                        size={16}
                        className={`shrink-0 ${
                          plan.featured ? "text-blue-300" : "text-green-500 dark:text-green-400"
                        }`}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => openRegister(plan.key)}
                  className={`w-full py-4 rounded-xl font-bold transition-all ${
                    plan.featured
                      ? "bg-white text-primary hover:bg-blue-50 dark:bg-white dark:text-blue-600 dark:hover:bg-slate-100"
                      : "bg-primary text-white hover:bg-primary/90 dark:bg-blue-600 dark:hover:bg-blue-700"
                  }`}
                  aria-label={`Selecionar plano ${plan.name}`}
                >
                  Selecionar
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
