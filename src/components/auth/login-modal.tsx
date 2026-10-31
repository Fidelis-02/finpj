"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSwitchToRegister: () => void;
}

export function LoginModal({ open, onClose, onSwitchToRegister }: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { sendCode, loginWithCode } = useAuth();
  const router = useRouter();

  const handleSendCode = async () => {
    setLoading(true);
    setError("");
    try {
      await sendCode(email);
      setCodeSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    setError("");
    try {
      await loginWithCode(email, code);
      onClose();
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Acesse sua conta" subtitle="Entrar">
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 mb-4 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400" role="alert">
          {error}
        </div>
      )}

      <div className="space-y-4">
          <Input
            label="E-mail"
            type="email"
            placeholder="voce@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {!codeSent ? (
            <Button
              className="w-full"
              loading={loading}
              onClick={handleSendCode}
              disabled={!email}
            >
              Enviar código
            </Button>
          ) : (
            <>
              <Input
                label="Código"
                placeholder="000000"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button
                variant="secondary"
                className="w-full"
                loading={loading}
                onClick={handleVerifyCode}
                disabled={!code}
              >
                Confirmar código
              </Button>
            </>
          )}
      </div>

      {/* SSO */}
      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/10">
        <a
          href="/api/auth/auth0/login"
          className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          aria-label="Entrar com SSO via Auth0"
        >
          <span className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center text-white text-xs font-bold">
            A0
          </span>
          Entrar com SSO
        </a>
      </div>

      <p className="text-center text-sm text-gray-500 mt-4 dark:text-slate-400">
        Não tem conta?{" "}
        <button
          onClick={onSwitchToRegister}
          className="text-blue-600 font-semibold hover:underline dark:text-blue-400"
        >
          Criar conta
        </button>
      </p>
    </Modal>
  );
}
