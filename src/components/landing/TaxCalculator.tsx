import React, { useState, useMemo } from 'react';
import { Calculator, CheckCircle, ArrowRight } from 'lucide-react';

const TaxCalculator = () => {
  const [revenue, setRevenue] = useState<number>(1200000);
  const [margin, setMargin] = useState<number>(15);
  const [payroll, setPayroll] = useState<number>(240000);
  const [segment, setSegment] = useState<string>('commerce');

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Simulated calculation logic based on standard fiscal rules
  const calculations = useMemo(() => {
    // 1. Simples Nacional (Simplified logic)
    let simplesRate = segment === 'commerce' ? 0.08 : segment === 'industry' ? 0.085 : 0.12;
    if (segment === 'services' && (payroll / revenue) >= 0.28) {
      simplesRate = 0.09; // Fator R benefit
    }
    const simplesEligible = revenue <= 4800000;
    const simplesTax = revenue * simplesRate;

    // 2. Lucro Presumido
    const presumedMargin = segment === 'commerce' ? 0.08 : segment === 'industry' ? 0.08 : 0.32;
    const irpjCsll = presumedMargin * 0.34;
    const pisCofins = 0.0365; // Cumulative
    const presumidoTax = revenue * (irpjCsll + pisCofins);

    // 3. Lucro Real
    const actualMargin = margin / 100;
    const irpjCsllReal = actualMargin > 0 ? actualMargin * 0.34 : 0;
    const pisCofinsReal = 0.0925; // Non-cumulative
    const realTax = revenue * irpjCsllReal + (revenue * pisCofinsReal * 0.6); // 0.6 simulates average credit offset

    const regimes = [
      {
        id: 'simples',
        name: 'Simples Nacional',
        tax: simplesTax,
        eligible: simplesEligible,
        rate: (simplesTax / revenue) * 100,
      },
      {
        id: 'presumido',
        name: 'Lucro Presumido',
        tax: presumidoTax,
        eligible: true,
        rate: (presumidoTax / revenue) * 100,
      },
      {
        id: 'real',
        name: 'Lucro Real',
        tax: realTax,
        eligible: true,
        rate: (realTax / revenue) * 100,
      },
    ].filter(r => r.eligible);

    // Find Best Option
    const sortedRegimes = [...regimes].sort((a, b) => a.tax - b.tax);
    const bestRegime = sortedRegimes[0];
    const worstRegime = sortedRegimes[sortedRegimes.length - 1];
    
    const potentialSavings = worstRegime.tax - bestRegime.tax;

    return {
      regimes,
      bestRegime,
      potentialSavings,
    };
  }, [revenue, margin, payroll, segment]);

  return (
    <div className="w-full max-w-5xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col lg:flex-row border border-slate-100">
      
      {/* Left Panel: Inputs */}
      <div className="w-full lg:w-1/2 p-8 lg:p-12 bg-slate-50 border-r border-slate-100">
        <div className="flex items-center space-x-3 mb-8">
          <div className="p-3 bg-blue-600 rounded-xl">
            <Calculator className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Simulador Fiscal</h2>
        </div>

        <div className="space-y-8">
          {/* Segment Dropdown */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
              Segmento Principal
            </label>
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none text-slate-800 font-medium"
            >
              <option value="commerce">Comércio</option>
              <option value="services">Serviços</option>
              <option value="industry">Indústria</option>
            </select>
          </div>

          {/* Revenue Slider */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
                Faturamento Anual
              </label>
              <span className="text-xl font-bold text-blue-600">
                {formatCurrency(revenue)}
              </span>
            </div>
            <input
              type="range"
              min="100000"
              max="10000000"
              step="100000"
              value={revenue}
              onChange={(e) => setRevenue(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Margin Slider */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
                Margem de Lucro Estimada
              </label>
              <span className="text-xl font-bold text-blue-600">{margin}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Payroll Slider */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center">
                Folha de Pagamento Anual
              </label>
              <span className="text-xl font-bold text-blue-600">
                {formatCurrency(payroll)}
              </span>
            </div>
            <input
              type="range"
              min="50000"
              max={revenue}
              step="10000"
              value={payroll}
              onChange={(e) => setPayroll(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            {segment === 'services' && (
              <p className="text-xs text-slate-500 mt-1">
                Usado para calcular o Fator R no Simples Nacional.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel: Results */}
      <div className="w-full lg:w-1/2 p-8 lg:p-12 flex flex-col justify-between bg-white">
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-6">
            Estimativa de Custo Tributário Anual
          </h3>
          
          <div className="space-y-4">
            {calculations.regimes.map((regime) => {
              const isBest = regime.id === calculations.bestRegime.id;
              
              return (
                <div 
                  key={regime.id}
                  className={`relative p-5 rounded-2xl border-2 transition-all ${
                    isBest ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-100 bg-white'
                  }`}
                >
                  {isBest && (
                    <div className="absolute -top-3 -right-2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Recomendado pela IA
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div className="flex flex-col">
                      <span className={`font-bold ${isBest ? 'text-emerald-800' : 'text-slate-700'}`}>
                        {regime.name}
                      </span>
                      <span className="text-sm text-slate-500">
                        Alíquota Efetiva: {regime.rate.toFixed(1)}%
                      </span>
                    </div>
                    <span className={`text-xl font-extrabold ${isBest ? 'text-emerald-600' : 'text-slate-800'}`}>
                      {formatCurrency(regime.tax)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-10">
          <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-600/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
            
            <p className="text-blue-100 text-sm font-medium mb-1">Economia Potencial Estimada</p>
            <div className="flex items-end gap-3 mb-6">
              <span className="text-4xl lg:text-5xl font-black tracking-tight">
                {formatCurrency(calculations.potentialSavings)}
              </span>
              <span className="text-blue-200 mb-1 font-medium">/ano</span>
            </div>
            
            <button className="w-full bg-white text-blue-600 hover:bg-blue-50 hover:scale-[1.02] transition-all py-4 px-6 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-sm">
              Fazer Diagnóstico Gratuito
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-center text-xs text-blue-200 mt-4">
              * Valores simulados. Um diagnóstico completo analisa seus NCMs e DRE.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default TaxCalculator;
