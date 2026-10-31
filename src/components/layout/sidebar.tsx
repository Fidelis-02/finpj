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
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

const overviewNav = [
  { key: "overview", label: "Raio-X Financeiro", icon: BarChart3, href: "/dashboard" },
];

const financialNav = [
  { key: "financial", label: "Fluxo de caixa", icon: DollarSign, href: "/dashboard/financial" },
  { key: "statements", label: "Demonstrações financeiras", icon: FileText, href: "/dashboard/statements" },
  { key: "ai", label: "Análise de documentos", icon: Upload, href: "/dashboard/ai" },
  { key: "openfinance", label: "Open Finance", icon: Landmark, href: "/dashboard/openfinance" },
];

const taxNav = [
  { key: "tax", label: "Comparar regimes", icon: Calculator, href: "/dashboard/tax" },
  { key: "diagnostics", label: "Diagnóstico tributário", icon: Stethoscope, href: "/dashboard/diagnostics" },
];

const intelligenceNav = [
  { key: "insights", label: "Central de alertas", icon: Lightbulb, href: "/dashboard/insights" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { user, activeCompany, companies, setActiveCompany, logout } = useAuth();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menu de navegação"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-xl bg-[#10233f] p-3 text-white shadow-lg md:hidden"
      >
        <Menu size={20} />
      </button>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 md:hidden"
        />
      )}
      <motion.aside
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className={cn(
          "h-screen fixed left-0 top-0 z-50 flex shrink-0 flex-col overflow-hidden border-r border-[#1e3a5f] bg-[#10233f] text-white transition-transform md:sticky md:z-auto",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">
            F
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-lg font-bold text-white whitespace-nowrap"
            >
              FinPJ
            </motion.span>
          )}
        </Link>
        <button
          onClick={() => {
            if (window.innerWidth < 768) setMobileOpen(false);
            else setCollapsed(!collapsed);
          }}
          aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 transition-colors shrink-0"
          title={collapsed ? "Expandir" : "Colapsar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Company card / Selector */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-white/10">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">
            Workspace
          </span>
          {companies.length > 1 ? (
            <select
              value={activeCompany?.id || ""}
              onChange={(e) => setActiveCompany(e.target.value)}
              className="w-full text-sm font-bold text-white bg-white/10 border border-white/10 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-400 truncate"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id} className="bg-white text-slate-900">
                  {c.nome || c.fantasia || c.cnpj}
                </option>
              ))}
            </select>
          ) : activeCompany ? (
            <>
              <p className="text-sm font-bold text-white truncate mt-0.5">
                {activeCompany.nome}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {activeCompany.cnpj}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-400 italic">Nenhuma empresa</p>
          )}
        </div>
      )}

      {/* Product navigation follows the TCC's finance, tax and intelligence modules. */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {!collapsed && (
          <span className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Visão executiva
          </span>
        )}
      {overviewNav.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
              isActive(item.href)
                ? "bg-blue-500 text-white shadow-sm"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            )}
            title={item.label}
            onClick={() => setMobileOpen(false)}
          >
            <item.icon size={18} className="shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        ))}

        <div className="pt-4">
          {!collapsed && (
            <span className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Gestão financeira
            </span>
          )}
          {financialNav.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive(item.href)
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              )}
              title={item.label}
              onClick={() => setMobileOpen(false)}
            >
              <item.icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          ))}
        </div>
        <div className="pt-4">
          {!collapsed && (
            <span className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Inteligência tributária
            </span>
          )}
          {taxNav.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive(item.href)
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              )}
              title={item.label}
              onClick={() => setMobileOpen(false)}
            >
              <item.icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          ))}
        </div>
        <div className="pt-4">
          {!collapsed && (
            <span className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Inteligência
            </span>
          )}
          {intelligenceNav.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive(item.href)
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              )}
              title={item.label}
              onClick={() => setMobileOpen(false)}
            >
              <item.icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-2 space-y-1">
        {!collapsed && user && (
          <div className="px-3 py-2">
            <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-300 text-xs font-bold mb-1">
              {(user.email?.[0] || "U").toUpperCase()}
            </div>
            <p className="text-xs font-semibold text-white truncate">
              {user.nome || user.email}
            </p>
            <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
          </div>
        )}

        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all"
          title="Configurações"
          onClick={() => setMobileOpen(false)}
        >
          <Settings size={18} className="shrink-0" />
          {!collapsed && <span>Configurações</span>}
        </Link>

        <button
          onClick={() => {
            setMobileOpen(false);
            logout();
          }}
          aria-label="Sair da conta"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-red-500/20 hover:text-red-200 transition-all w-full text-left"
          title="Sair"
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
      </motion.aside>
    </>
  );
}
