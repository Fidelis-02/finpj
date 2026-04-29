"use client";

import { Lightbulb, AlertTriangle, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function InsightsPage() {
  return (
    <div className="space-y-8">
      <div>
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <span>FinPJ</span><span>/</span>
          <span className="text-primary font-semibold">Insights</span>
        </nav>
        <h1 className="text-3xl font-bold text-primary">Insights e alertas</h1>
        <p className="text-gray-500 mt-1">Recomendações práticas e próximos passos para sua empresa.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-bold text-primary mb-4">Recomendações práticas</h3>
          <div className="space-y-3">
            {[
              "Revise a tributação das notas emitidas no último trimestre.",
              "Avalie a migração de regime caso o faturamento ultrapasse R$ 4,8M.",
              "Automatize a conciliação bancária para ganhar 3h por semana.",
            ].map((text, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-xl bg-blue-50/50 border border-blue-100"
              >
                <Lightbulb size={16} className="text-blue-500 mt-0.5 shrink-0" />
                <span className="text-sm text-gray-700">{text}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="font-bold text-primary mb-4">Prioridades e próximos passos</h3>
          <div className="space-y-3">
            {[
              { text: "Enviar DRE do mês anterior", done: false },
              { text: "Conectar conta bancária via Open Finance", done: false },
              { text: "Configurar alertas de vencimento fiscal", done: true },
            ].map((item, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-xl border ${
                  item.done
                    ? "bg-green-50/50 border-green-100"
                    : "bg-amber-50/50 border-amber-100"
                }`}
              >
                {item.done ? (
                  <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                )}
                <span
                  className={`text-sm ${
                    item.done ? "text-green-700 line-through" : "text-gray-700"
                  }`}
                >
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
