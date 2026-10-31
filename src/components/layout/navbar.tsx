"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuth } from "@/contexts/auth-context";

interface NavbarProps {
  onOpenLogin?: () => void;
  onOpenRegister?: () => void;
}

export function Navbar({ onOpenLogin, onOpenRegister }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, logout } = useAuth();

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-[#07111f]/90 backdrop-blur-md z-50">
      <Link href="/" className="flex items-center gap-2" aria-label="FinPJ — Página inicial">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
          F
        </div>
        <span className="text-xl font-bold text-white">FinPJ</span>
      </Link>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-8" role="navigation" aria-label="Navegação principal">
        <a
          href="#como-funciona"
          className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          Como Funciona
        </a>
        <a
          href="#simulador"
          className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          Simulador
        </a>
        <a
          href="#planos"
          className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          Planos
        </a>
        {isAuthenticated && (
          <Link
            href="/dashboard"
            className="text-sm font-medium text-blue-300 hover:text-white transition-colors"
          >
            Dashboard
          </Link>
        )}
      </nav>

      <div className="hidden md:flex items-center gap-3">
        <ThemeToggle />
        {isAuthenticated ? (
          <>
            <Link href="/dashboard">
              <Button variant="primary" size="sm" aria-label="Ir para o Dashboard">
                Dashboard
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={logout} aria-label="Sair da conta">
              Sair
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={onOpenLogin} aria-label="Acessar sua conta">
              Acessar Conta
            </Button>
            <a href="#simulador">
              <Button variant="primary" size="lg" aria-label="Ir para o simulador de regime tributário">
                Simular Regime
              </Button>
            </a>
          </>
        )}
      </div>

      {/* Mobile toggle */}
      <div className="flex items-center gap-2 md:hidden">
        <ThemeToggle />
        <button
          className="p-2 text-slate-400"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-full left-0 right-0 bg-[#07111f] border-b border-white/10 shadow-lg p-6 flex flex-col gap-4 md:hidden"
          role="menu"
        >
          <a
            href="#como-funciona"
            className="text-sm font-medium text-slate-300"
            onClick={() => setMobileOpen(false)}
            role="menuitem"
          >
            Como Funciona
          </a>
          <a
            href="#simulador"
            className="text-sm font-medium text-slate-300"
            onClick={() => setMobileOpen(false)}
            role="menuitem"
          >
            Simulador
          </a>
          <a
            href="#planos"
            className="text-sm font-medium text-slate-300"
            onClick={() => setMobileOpen(false)}
            role="menuitem"
          >
            Planos
          </a>
          {isAuthenticated ? (
            <>
              <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                <Button variant="primary" className="w-full" aria-label="Ir para o Dashboard">
                  Dashboard
                </Button>
              </Link>
              <Button
                variant="ghost"
                onClick={() => {
                  logout();
                  setMobileOpen(false);
                }}
                aria-label="Sair da conta"
              >
                Sair
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  onOpenLogin?.();
                  setMobileOpen(false);
                }}
                aria-label="Acessar sua conta"
              >
                Acessar Conta
              </Button>
              <a href="#simulador" onClick={() => setMobileOpen(false)}>
                <Button variant="primary" className="w-full" aria-label="Ir para o simulador de regime tributário">
                  Simular Regime
                </Button>
              </a>
            </>
          )}
        </motion.div>
      )}
    </header>
  );
}
