"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  DollarSign,
  Percent,
  AlertTriangle,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface KPIData {
  monthlyRevenue: number;
  monthlyTaxes: number;
  profitMargin: number;
  taxSavings: number;
  alerts: number;
}

const kpiConfig = [
  {
    key: "monthlyRevenue",
    label: "Receita mensal",
    icon: TrendingUp,
    color: "text-green-600",
    bg: "bg-green-50",
    format: (v: number) => formatCurrency(v),
    href: "/dashboard/financial",
  },
  {
    key: "monthlyTaxes",
    label: "Impostos mensais",
    icon: DollarSign,
    color: "text-red-500",
    bg: "bg-red-50",
    format: (v: number) => formatCurrency(v),
    href: "/dashboard/tax",
  },
  {
    key: "profitMargin",
    label: "Margem de lucro",
    icon: Percent,
    color: "text-blue-600",
    bg: "bg-blue-50",
    format: (v: number) => `${(v * 100).toFixed(1)}%`,
    href: "/dashboard/statements",
  },
  {
    key: "taxSavings",
    label: "Economia tributária",
    icon: BarChart3,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    format: (v: number) => formatCurrency(v),
    href: "/dashboard/diagnostics",
  },
  {
    key: "alerts",
    label: "Alertas",
    icon: AlertTriangle,
    color: "text-amber-600",
    bg: "bg-amber-50",
    format: (v: number) => String(v),
    href: "/dashboard/insights",
  },
];

export default function DashboardOverview() {
  const { activeCompany, user } = useAuth();
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiRequest<{ kpis: KPIData }>("/api/dashboard/overview");
        setKpis(data.kpis);
      } catch {
        // Use placeholder data
        setKpis({
          monthlyRevenue: 0,
          monthlyTaxes: 0,
          profitMargin: 0,
          taxSavings: 0,
          alerts: 0,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeCompany]);

  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <span>FinPJ</span>
          <span>/</span>
          <span className="text-primary font-semibold">Visão geral</span>
        </nav>
        <h1 className="text-3xl font-bold text-primary">Visão financeira</h1>
        <p className="text-gray-500 mt-1">
          {activeCompany
            ? `Dashboard de ${activeCompany.nome}`
            : `Bem-vindo, ${user?.email || "usuário"}`}
        </p>
      </div>

      {/* KPIs */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
      >
        {kpiConfig.map((kpi) => (
          <motion.div key={kpi.key} variants={fadeUp}>
            <Link href={kpi.href}>
              <Card hover className="group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {kpi.label}
                  </span>
                  <div
                    className={`w-8 h-8 ${kpi.bg} rounded-lg flex items-center justify-center`}
                  >
                    <kpi.icon size={16} className={kpi.color} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {loading ? (
                    <div className="h-8 bg-gray-100 rounded-lg animate-pulse w-24" />
                  ) : (
                    kpi.format((kpis as any)?.[kpi.key] || 0)
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1 group-hover:text-blue-600 transition-colors">
                  Ver detalhes →
                </p>
              </Card>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart placeholder */}
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <Card className="h-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-primary">Receita vs impostos</h3>
                <p className="text-sm text-gray-400">
                  Comparativo mensal para decisão rápida.
                </p>
              </div>
              <Link href="/dashboard/financial">
                <Button variant="outline" size="sm">
                  Detalhar
                </Button>
              </Link>
            </div>
            <div className="flex items-end gap-3 h-40 px-2">
              {[40, 65, 45, 80, 55, 90, 70, 60].map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: 0.3 + i * 0.08, duration: 0.5 }}
                  className="flex-1 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md"
                />
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-2 px-2">
              {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago"].map(
                (m) => (
                  <span key={m}>{m}</span>
                )
              )}
            </div>
          </Card>
        </motion.div>

        {/* Insights */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          transition={{ delay: 0.2 }}
        >
          <Card className="h-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-primary">Insights e alertas</h3>
                <p className="text-sm text-gray-400">
                  Somente o que pede ação.
                </p>
              </div>
              <Link href="/dashboard/insights">
                <Button variant="outline" size="sm">
                  Ver tudo
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {[
                {
                  text: "Imposto sobre NF pode estar acima da média do setor",
                  type: "warning",
                },
                {
                  text: "Margem operacional subiu 2.3% no último mês",
                  type: "success",
                },
                {
                  text: "3 pendências fiscais vencem nos próximos 7 dias",
                  type: "danger",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-xl border ${
                    item.type === "warning"
                      ? "bg-amber-50/50 border-amber-100"
                      : item.type === "success"
                      ? "bg-green-50/50 border-green-100"
                      : "bg-red-50/50 border-red-100"
                  }`}
                >
                  <AlertTriangle
                    size={16}
                    className={`mt-0.5 shrink-0 ${
                      item.type === "warning"
                        ? "text-amber-500"
                        : item.type === "success"
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  />
                  <span className="text-sm text-gray-700">{item.text}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
