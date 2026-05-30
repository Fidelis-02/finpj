"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { CashflowChart } from "@/components/dashboard/cashflow-chart";
import Link from "next/link";

export default function FinancialPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiRequest("/api/dashboard/financial");
        setData(res);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const metrics = [
    { label: "Receita", key: "income", icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
    { label: "Despesas", key: "expenses", icon: TrendingDown, color: "text-red-500", bg: "bg-red-50" },
    { label: "Lucro", key: "profit", icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <span>FinPJ</span><span>/</span>
          <span className="text-primary font-semibold">Monitor de Custos</span>
        </nav>
        <h1 className="text-3xl font-bold text-primary">Monitor de custos</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metrics.map((m, i) => (
          <motion.div
            key={m.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 ${m.bg} rounded-xl flex items-center justify-center`}>
                  <m.icon size={20} className={m.color} />
                </div>
                <span className="text-sm font-semibold text-gray-500">{m.label}</span>
              </div>
              <div className="text-2xl font-bold text-primary" data-testid={`financial-kpi-${m.key}`}>
                {loading ? (
                  <div className="h-8 bg-gray-100 rounded-lg animate-pulse w-28" />
                ) : (
                  formatCurrency(data?.[m.key] || 0)
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Conditional Rendering based on Open Finance bank connection */}
      {loading ? (
        <div className="h-64 bg-slate-900/5 rounded-2xl animate-pulse border border-slate-100" />
      ) : !data?.hasBankConnected ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          data-testid="pluggy-connect-cta"
        >
          <Card className="p-8 text-center border-dashed border-2 border-slate-200 bg-white/50 backdrop-blur-sm max-w-3xl mx-auto">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <TrendingUp size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">Conecte sua conta bancária para desbloquear</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-8 text-sm leading-relaxed">
              Importe suas movimentações de forma automática e tenha acesso a análises de fluxo de caixa, monitor de categorias e diagnósticos de economia fiscal.
            </p>
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-8 text-left text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-2">✓ Fluxo de caixa automático</div>
              <div className="flex items-center gap-2">✓ Projeções financeiras</div>
              <div className="flex items-center gap-2">✓ Insights tributários</div>
              <div className="flex items-center gap-2">✓ Alertas inteligentes</div>
            </div>
            <Link href="/dashboard/openfinance">
              <Button className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-xl transition-all shadow-md shadow-blue-500/10">
                Conectar Open Finance via Pluggy
              </Button>
            </Link>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="financial-data-grid">
          <Card>
            <h3 className="font-bold text-primary mb-4">Fluxo de caixa projetado</h3>
            <CashflowChart />
          </Card>
          <Card>
            <h3 className="font-bold text-primary mb-4">Categorias em atenção</h3>
            {data?.categories && data.categories.length > 0 ? (
              <div className="space-y-4">
                {data.categories.map((cat: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-sm font-medium text-slate-700">{cat.name}</span>
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(cat.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <AlertTriangle size={36} className="mx-auto mb-3 opacity-30 text-amber-500" />
                <p className="text-sm">Nenhuma categoria de custos com atenção identificada no momento.</p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
