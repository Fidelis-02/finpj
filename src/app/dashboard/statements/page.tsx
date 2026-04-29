"use client";

import { FileText, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function StatementsPage() {
  return (
    <div className="space-y-8">
      <div>
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <span>FinPJ</span><span>/</span>
          <span className="text-primary font-semibold">Analisador DRE</span>
        </nav>
        <h1 className="text-3xl font-bold text-primary">DRE e balanço patrimonial</h1>
      </div>

      <Card className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1">
          <h3 className="font-bold text-primary text-lg mb-2">Ative seus indicadores</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            Envie demonstrativos para ativar indicadores como EBITDA, margem de contribuição e liquidez.
          </p>
        </div>
        <Link href="/dashboard/ai">
          <Button>
            <Upload size={16} /> Enviar documento
          </Button>
        </Link>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-bold text-primary mb-4">Leitura gerencial</h3>
          <div className="text-center py-12 text-gray-400">
            <FileText size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm">Envie um documento DRE para visualizar a leitura.</p>
          </div>
        </Card>
        <Card>
          <h3 className="font-bold text-primary mb-4">Pontos críticos e gargalos</h3>
          <div className="text-center py-12 text-gray-400">
            <FileText size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm">Dados aparecerão aqui após a análise.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
