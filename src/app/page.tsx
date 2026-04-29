"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { maskCurrency, parseCurrencyInput } from "@/lib/utils";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  ShieldCheck,
  Check,
  Star,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { LoginModal } from "@/components/auth/login-modal";
import { RegisterModal } from "@/components/auth/register-modal";
const TaxEngine = require("@/tax/index.js");

export default function Home() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("growth");
  const [simCnpj, setSimCnpj] = useState("");
  const [simFaturamento, setSimFaturamento] = useState("");
  const [simResult, setSimResult] = useState<any>(null);

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

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simCnpj || !simFaturamento) return;
    try {
      const revenue = parseCurrencyInput(simFaturamento);
      if (isNaN(revenue) || revenue <= 0) return;
      const sim = TaxEngine.simulateTaxes({
        annualRevenue: revenue,
        margin: 0.15, // default guess
        activity: "comercio", // default guess
      });
      setSimResult(sim);
    } catch (err) {
      console.error(err);
    }
  };

  const formatBRL = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <main className="min-h-screen bg-white">
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold uppercase tracking-wider">
            Open Finance • Impostos • Caixa
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold leading-tight text-primary">
            Controle financeiro PJ com{" "}
            <span className="text-blue-600">previsibilidade.</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-xl">
            Conecte bancos, acompanhe movimentações e organize indicadores sem
            planilhas quebradas ou etapas desnecessárias.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              onClick={() => openRegister()}
              className="bg-primary text-white px-8 py-4 rounded-full font-semibold flex items-center justify-center gap-2 hover:translate-y-[-2px] transition-all shadow-lg"
            >
              Testar agora <ArrowRight size={20} />
            </button>
            <button
              onClick={openLogin}
              className="border border-gray-200 text-gray-700 px-8 py-4 rounded-full font-semibold hover:bg-gray-50 transition-all"
            >
              Já tenho conta
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex-1 relative"
        >
          <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100 overflow-hidden relative">
            <div className="flex items-center justify-between mb-8">
              <span className="text-lg font-bold text-gray-800">
                Visão executiva
              </span>
              <span className="text-sm font-medium text-gray-400 uppercase">
                Hoje
              </span>
            </div>

            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-blue-50/50 border border-blue-100">
                <span className="text-sm font-medium text-blue-600">
                  Saldo projetado
                </span>
                <div className="text-3xl font-bold text-primary mt-1">
                  R$ 42.800
                </div>
                <div className="text-sm text-green-600 font-medium mt-1">
                  +18% nos próximos 30 dias
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-gray-50 text-center">
                  <span className="text-[10px] uppercase text-gray-400 font-bold">
                    Receitas
                  </span>
                  <div className="font-bold text-gray-800">R$ 128k</div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 text-center">
                  <span className="text-[10px] uppercase text-gray-400 font-bold">
                    Impostos
                  </span>
                  <div className="font-bold text-gray-800">R$ 9,4k</div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 text-center">
                  <span className="text-[10px] uppercase text-gray-400 font-bold">
                    Pendências
                  </span>
                  <div className="font-bold text-gray-800">3</div>
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
            className="absolute -top-6 -right-6 p-4 bg-white rounded-2xl shadow-xl border border-gray-100 hidden md:block"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                <BarChart3 size={20} />
              </div>
              <div>
                <div className="text-xs font-bold">Meta batida</div>
                <div className="text-[10px] text-gray-400">Março 2026</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="recursos" className="bg-gray-50 py-24">
        <div className="container mx-auto px-6 text-center mb-16">
          <span className="text-blue-600 font-bold text-sm uppercase tracking-widest">
            Operação limpa
          </span>
          <h2 className="text-4xl font-bold text-primary mt-4">
            O essencial para decidir rápido.
          </h2>
        </div>

        <div className="container mx-auto px-6 grid md:grid-cols-3 gap-8">
          {[
            {
              title: "Cadastro direto",
              description:
                "Fluxo de CNPJ com validação, persistência e login imediato após a criação.",
              icon: <ShieldCheck className="text-blue-600" size={24} />,
            },
            {
              title: "Open Finance",
              description:
                "Conecte bancos com segurança e acompanhe movimentações em poucos cliques.",
              icon: <ArrowRight className="text-blue-600" size={24} />,
            },
            {
              title: "Dashboard protegido",
              description:
                "Indicadores e bancos carregam apenas com sessão válida.",
              icon: <BarChart3 className="text-blue-600" size={24} />,
            },
          ].map((feature, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -5 }}
              className="p-8 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all"
            >
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-primary mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Simulator Section */}
      <section id="simulador" className="py-24 container mx-auto px-6">
        <div className="bg-primary rounded-[3rem] p-12 lg:p-20 text-white overflow-hidden relative">
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
            <div className="bg-white/10 backdrop-blur-xl border border-white/10 p-8 rounded-3xl">
              {!simResult ? (
                <form onSubmit={handleSimulate} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-blue-200 block mb-2">
                      CNPJ
                    </label>
                    <input
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder:text-white/40"
                      placeholder="00.000.000/0001-00"
                      value={simCnpj}
                      onChange={(e) => setSimCnpj(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-blue-200 block mb-2">
                      Faturamento anual
                    </label>
                    <input
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder:text-white/40"
                      placeholder="0,00"
                      value={simFaturamento}
                      onChange={(e) => setSimFaturamento(maskCurrency(e.target.value))}
                      inputMode="numeric"
                      required
                    />
                  </div>
                  <button type="submit" className="w-full bg-white text-primary font-bold py-4 rounded-xl mt-4 hover:bg-blue-50 transition-colors">
                    Simular regime
                  </button>
                </form>
              ) : (
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
                    onClick={() => openRegister("growth", simCnpj, simFaturamento)}
                    className="w-full bg-blue-500 text-white font-bold py-4 rounded-xl hover:bg-blue-600 transition-colors shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                  >
                    Criar conta para ver DRE completo
                  </button>
                  <button
                    onClick={() => setSimResult(null)}
                    className="w-full text-blue-200 text-sm hover:text-white transition-colors"
                  >
                    Refazer simulação
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* Abstract background blobs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-400/10 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="py-24 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-blue-600 font-bold text-sm uppercase tracking-widest">
              Planos
            </span>
            <h2 className="text-4xl font-bold text-primary mt-4">
              Escolha o ritmo da sua empresa.
            </h2>
            <p className="text-gray-500 mt-3 max-w-lg mx-auto">
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
                    ? "bg-primary text-white shadow-2xl shadow-primary/20 scale-105 border-2 border-blue-400"
                    : "bg-white text-gray-900 border border-gray-100 shadow-sm hover:shadow-xl"
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
                      plan.featured ? "text-blue-300" : "text-blue-600"
                    }`}
                  >
                    {plan.name}
                  </span>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-4xl font-bold">R$ {plan.price}</span>
                    <span
                      className={`text-sm ${
                        plan.featured ? "text-blue-200" : "text-gray-400"
                      }`}
                    >
                      /mês
                    </span>
                  </div>
                  <p
                    className={`text-sm mt-2 ${
                      plan.featured ? "text-blue-100/80" : "text-gray-500"
                    }`}
                  >
                    {plan.description}
                  </p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm">
                      <Check
                        size={16}
                        className={`shrink-0 ${
                          plan.featured ? "text-blue-300" : "text-green-500"
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
                      ? "bg-white text-primary hover:bg-blue-50"
                      : "bg-primary text-white hover:bg-primary/90"
                  }`}
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
