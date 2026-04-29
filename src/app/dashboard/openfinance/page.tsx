"use client";

import { Landmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function OpenFinancePage() {
  const handleConnect = () => {
    // Pluggy Connect integration placeholder
    if (typeof window !== "undefined" && (window as any).PluggyConnect) {
      // Trigger Pluggy widget
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <span>FinPJ</span><span>/</span>
          <span className="text-primary font-semibold">Open Finance</span>
        </nav>
        <h1 className="text-3xl font-bold text-primary">Open Finance</h1>
      </div>

      <Card className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1">
          <h3 className="font-bold text-primary text-lg mb-2">Conectar banco</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            Conecte sua conta empresarial para importar movimentações e melhorar as análises financeiras.
          </p>
        </div>
        <Button onClick={handleConnect}>
          <Landmark size={16} /> Conectar banco
        </Button>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-bold text-primary mb-4">Sinais fiscais bancários</h3>
          <div className="text-center py-12 text-gray-400">
            <Landmark size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm">Conecte um banco para ver sinais fiscais.</p>
          </div>
        </Card>
        <Card>
          <h3 className="font-bold text-primary mb-4">Últimos lançamentos</h3>
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">Transações aparecerão após a conexão bancária.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
