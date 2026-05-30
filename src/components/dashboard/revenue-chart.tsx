"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const mockData = [
  { name: "Jan", receita: 4000, impostos: 2400 },
  { name: "Fev", receita: 3000, impostos: 1398 },
  { name: "Mar", receita: 2000, impostos: 9800 },
  { name: "Abr", receita: 2780, impostos: 3908 },
  { name: "Mai", receita: 1890, impostos: 4800 },
  { name: "Jun", receita: 2390, impostos: 3800 },
  { name: "Jul", receita: 3490, impostos: 4300 },
  { name: "Ago", receita: 4000, impostos: 2400 },
];

export function RevenueChart() {
  return (
    <div className="w-full h-56 mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={mockData}
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
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: "#9ca3af" }}
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
