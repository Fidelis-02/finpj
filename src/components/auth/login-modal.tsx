"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSwitchToRegister: () => void;
}

export function LoginModal({ open, onClose, onSwitchToRegister }: LoginModalProps) {
  const [tab, setTab] = useState<"email" | "cnpj">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [password, setPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login, sendCode, loginWithCode } = useAuth();

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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCnpjLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await login({ cnpj, password });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Acesse sua conta" subtitle="Entrar">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        <button
          onClick={() => setTab("email")}
          className={`flex-1 text-sm font-semibold py-2.5 rounded-lg transition-all ${
            tab === "email"
              ? "bg-white text-primary shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          E-mail
        </button>
        <button
          onClick={() => setTab("cnpj")}
          className={`flex-1 text-sm font-semibold py-2.5 rounded-lg transition-all ${
            tab === "cnpj"
              ? "bg-white text-primary shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          CNPJ
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {tab === "email" ? (
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
      ) : (
        <div className="space-y-4">
          <Input
            label="CNPJ"
            placeholder="00.000.000/0001-00"
            inputMode="numeric"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
          />
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            className="w-full"
            loading={loading}
            onClick={handleCnpjLogin}
            disabled={!cnpj || !password}
          >
            Entrar com CNPJ
          </Button>
        </div>
      )}

      {/* SSO */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <a
          href="/api/auth/auth0/login"
          className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center text-white text-xs font-bold">
            A0
          </span>
          Entrar com SSO
        </a>
      </div>

      <p className="text-center text-sm text-gray-500 mt-4">
        Não tem conta?{" "}
        <button
          onClick={onSwitchToRegister}
          className="text-blue-600 font-semibold hover:underline"
        >
          Criar conta
        </button>
      </p>
    </Modal>
  );
}
