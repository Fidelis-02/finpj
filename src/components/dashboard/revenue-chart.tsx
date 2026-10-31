"use client";

import { BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface RevenueChartProps {
  labels: string[];
  revenue: number[];
  taxes: number[];
}

export function RevenueChart({ labels, revenue, taxes }: RevenueChartProps) {
  const data = labels.map((name, index) => ({
    name,
    receita: revenue[index] || 0,
    impostos: taxes[index] || 0,
  }));
  return (
    <div className="w-full h-56 mt-4" data-testid="dashboard-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 10,
            right: 10,
            left: -20,
            bottom: 0,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: "#9ca3af" }}
            dy={10}
          />
          <Tooltip 
            cursor={{ fill: 'transparent' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
          />
          <Bar dataKey="receita" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={12} />
          <Bar dataKey="impostos" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
