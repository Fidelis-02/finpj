"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface ValuationData {
  nopat: number;
  capitalInvestido: number;
  wacc: number;
  eva: number;
  projectedFlows: any[];
  enterpriseValue: number;
}

export function ValuationCard({ companyId }: { companyId?: string }) {
  const [data, setData] = useState<ValuationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [wacc, setWacc] = useState(12);

  useEffect(() => {
    let active = true;
    const fetchValuation = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams();
        query.set("wacc", (wacc / 100).toString());
        if (companyId) query.set("companyId", companyId);
        
        const res = await apiRequest(`/api/finance/valuation?${query.toString()}`);
        if (active && res.sucesso) {
          setData(res);
        }
      } catch (e) {
        console.error("Failed to load valuation", e);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchValuation();
    return () => { active = false; };
  }, [wacc, companyId]);

  return (
    <Card className="p-6 h-full flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      </div>
      
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="font-bold text-primary">Valuation (FCD & EVA)</h3>
          <p className="text-sm text-gray-400 mt-1">Estimativa de valor do negócio baseada em fluxo de caixa descontado.</p>
        </div>
        <div className="text-right">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Custo de Capital (WACC)</label>
          <div className="flex items-center gap-2">
            <input 
              type="range" 
              min="5" 
              max="25" 
              value={wacc} 
              onChange={(e) => setWacc(Number(e.target.value))}
              className="w-24 accent-blue-600"
            />
            <span className="text-sm font-bold text-primary w-8">{wacc}%</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {loading || !data ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            <div className="mb-6">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Enterprise Value (Estimado)</span>
              <span className="text-4xl font-black text-primary tracking-tight">
                {formatCurrency(data.enterpriseValue)}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
              <div>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1">EVA (Lucro Econômico)</span>
                <span className={`text-lg font-bold ${data.eva >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatCurrency(data.eva)}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1">NOPAT Anual</span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(data.nopat)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
