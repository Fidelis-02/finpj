"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

interface NavbarProps {
  onOpenLogin?: () => void;
  onOpenRegister?: () => void;
}

export function Navbar({ onOpenLogin, onOpenRegister }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, logout } = useAuth();

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-md z-50">
      <Link href="/" className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">
          F
        </div>
        <span className="text-xl font-bold text-primary">FinPJ</span>
      </Link>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-8">
        <a
          href="#recursos"
          className="text-sm font-medium text-gray-600 hover:text-primary transition-colors"
        >
          Recursos
        </a>
        <a
          href="#simulador"
          className="text-sm font-medium text-gray-600 hover:text-primary transition-colors"
        >
          Simulador
        </a>
        <a
          href="#planos"
          className="text-sm font-medium text-gray-600 hover:text-primary transition-colors"
        >
          Planos
        </a>
        {isAuthenticated && (
          <Link
            href="/dashboard"
            className="text-sm font-medium text-blue-600 hover:text-primary transition-colors"
          >
            Dashboard
          </Link>
        )}
      </nav>

      <div className="hidden md:flex items-center gap-3">
        {isAuthenticated ? (
          <>
            <Link href="/dashboard">
              <Button variant="primary" size="sm">
                Dashboard
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={logout}>
              Sair
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={onOpenLogin}>
              Entrar
            </Button>
            <Button variant="primary" size="lg" onClick={onOpenRegister}>
              Começar agora
            </Button>
          </>
        )}
      </div>

      {/* Mobile toggle */}
      <button
        className="md:hidden p-2 text-gray-600"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Menu"
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-full left-0 right-0 bg-white border-b border-gray-100 shadow-lg p-6 flex flex-col gap-4 md:hidden"
        >
          <a
            href="#recursos"
            className="text-sm font-medium text-gray-600"
            onClick={() => setMobileOpen(false)}
          >
            Recursos
          </a>
          <a
            href="#simulador"
            className="text-sm font-medium text-gray-600"
            onClick={() => setMobileOpen(false)}
          >
            Simulador
          </a>
          <a
            href="#planos"
            className="text-sm font-medium text-gray-600"
            onClick={() => setMobileOpen(false)}
          >
            Planos
          </a>
          {isAuthenticated ? (
            <>
              <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                <Button variant="primary" className="w-full">
                  Dashboard
                </Button>
              </Link>
              <Button
                variant="ghost"
                onClick={() => {
                  logout();
                  setMobileOpen(false);
                }}
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
              >
                Entrar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  onOpenRegister?.();
                  setMobileOpen(false);
                }}
              >
                Começar agora
              </Button>
            </>
          )}
        </motion.div>
      )}
    </header>
  );
}
