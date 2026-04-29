"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

export default function AIPage() {
  const [tipo, setTipo] = useState("dre");
  const [contexto, setContexto] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setResult("Erro: O arquivo excede o limite máximo de 50 MB.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("tipo", tipo);
      formData.append("contexto", contexto);
      formData.append("arquivo", file);

      const data = await apiRequest<{ resultado: string }>(
        "/api/ai/analyze",
        {
          method: "POST",
          body: formData,
          headers: {},
        }
      );
      setResult(data.resultado);
    } catch (err: any) {
      setResult(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <span>FinPJ</span><span>/</span>
          <span className="text-primary font-semibold">Importar Documentos</span>
        </nav>
        <h1 className="text-3xl font-bold text-primary">Análise de documentos por IA</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Tipo de documento</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              >
                <option value="dre">DRE</option>
                <option value="balanco">Balanço patrimonial</option>
                <option value="extrato">Extrato bancário</option>
              </select>
            </div>

            <Input
              label="Contexto adicional"
              placeholder="Ex.: empresa de serviços, regime Simples"
              value={contexto}
              onChange={(e) => setContexto(e.target.value)}
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Arquivo (PDF, Excel, CSV, TXT ou imagem)
              </label>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-blue-400 transition-colors cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.xlsx,.xls,.ods,.csv,.txt,.jpg,.jpeg,.png,.webp,.bmp,.tiff"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload size={32} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">
                    {file ? file.name : "Clique ou arraste o arquivo aqui"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Limite: até 50 MB por arquivo (Pode enviar DREs de dezenas de páginas)
                  </p>
                </label>
              </div>
            </div>

            <Button type="submit" className="w-full" loading={loading} disabled={!file}>
              Analisar documento
            </Button>
          </form>
        </Card>

        <Card>
          <h3 className="font-bold text-primary mb-4">Resultado da análise</h3>
          {result ? (
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {result}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Upload size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-sm">Envie um documento para exibir a análise.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
