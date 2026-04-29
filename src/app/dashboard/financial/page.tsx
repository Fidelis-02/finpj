"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

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
              <div className="text-2xl font-bold text-primary">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-bold text-primary mb-4">Fluxo de caixa projetado</h3>
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">Dados serão exibidos após conectar um banco ou importar dados.</p>
          </div>
        </Card>
        <Card>
          <h3 className="font-bold text-primary mb-4">Categorias em atenção</h3>
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">As categorias aparecerão com as transações importadas.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
