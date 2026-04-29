"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  Calculator,
  FileText,
  DollarSign,
  Landmark,
  Upload,
  Stethoscope,
  Lightbulb,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

const mainNav = [
  { key: "overview", label: "Raio-X Financeiro", icon: BarChart3, href: "/dashboard" },
  { key: "tax", label: "Motor Fiscal", icon: Calculator, href: "/dashboard/tax" },
  { key: "statements", label: "Analisador DRE", icon: FileText, href: "/dashboard/statements" },
  { key: "financial", label: "Monitor de Custos", icon: DollarSign, href: "/dashboard/financial" },
];

const operationNav = [
  { key: "openfinance", label: "Open Finance", icon: Landmark, href: "/dashboard/openfinance" },
  { key: "ai", label: "Importar Documentos", icon: Upload, href: "/dashboard/ai" },
  { key: "diagnostics", label: "Diagnóstico Fiscal", icon: Stethoscope, href: "/dashboard/diagnostics" },
  { key: "insights", label: "Insights", icon: Lightbulb, href: "/dashboard/insights" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, activeCompany, logout } = useAuth();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="h-screen sticky top-0 bg-white border-r border-gray-100 flex flex-col overflow-hidden shrink-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-50">
        <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">
            F
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-lg font-bold text-primary whitespace-nowrap"
            >
              FinPJ
            </motion.span>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors shrink-0"
          title={collapsed ? "Expandir" : "Colapsar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Company card */}
      {!collapsed && activeCompany && (
        <div className="px-4 py-3 border-b border-gray-50">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Workspace
          </span>
          <p className="text-sm font-bold text-primary truncate mt-0.5">
            {activeCompany.nome}
          </p>
          <p className="text-[11px] text-gray-400 truncate">
            {activeCompany.cnpj}
          </p>
        </div>
      )}

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {!collapsed && (
          <span className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Principal
          </span>
        )}
        {mainNav.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
              isActive(item.href)
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-primary"
            )}
            title={item.label}
          >
            <item.icon size={18} className="shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        ))}

        <div className="pt-4">
          {!collapsed && (
            <span className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Operação
            </span>
          )}
          {operationNav.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive(item.href)
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-primary"
              )}
              title={item.label}
            >
              <item.icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-50 p-2 space-y-1">
        {!collapsed && user && (
          <div className="px-3 py-2">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-xs font-bold mb-1">
              {(user.email?.[0] || "U").toUpperCase()}
            </div>
            <p className="text-xs font-semibold text-primary truncate">
              {user.nome || user.email}
            </p>
            <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
          </div>
        )}

        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-primary transition-all"
          title="Configurações"
        >
          <Settings size={18} className="shrink-0" />
          {!collapsed && <span>Configurações</span>}
        </Link>

        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all w-full text-left"
          title="Sair"
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </motion.aside>
  );
}
