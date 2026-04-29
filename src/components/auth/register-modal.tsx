"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/api";

interface RegisterModalProps {
  open: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
  defaultPlan?: string;
  defaultCnpj?: string;
  defaultFaturamento?: string;
}

export function RegisterModal({
  open,
  onClose,
  onSwitchToLogin,
  defaultPlan = "growth",
  defaultCnpj = "",
  defaultFaturamento = "",
}: RegisterModalProps) {
  const [cnpj, setCnpj] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [plan, setPlan] = useState(defaultPlan);
  const [faturamento, setFaturamento] = useState("");
  const [margem, setMargem] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [error, setError] = useState("");

  const { register } = useAuth();

  useEffect(() => {
    if (open) {
      if (defaultCnpj && defaultCnpj !== cnpj) {
        handleCnpjChange(defaultCnpj);
      }
      if (defaultFaturamento) {
        setFaturamento(defaultFaturamento);
      }
      if (defaultPlan) {
        setPlan(defaultPlan);
      }
    }
  }, [open, defaultCnpj, defaultFaturamento, defaultPlan]);

  // Auto-lookup CNPJ when it has 14+ digits
  const handleCnpjChange = async (value: string) => {
    setCnpj(value);
    const digits = value.replace(/\D/g, "");
    if (digits.length >= 14) {
      setLookupLoading(true);
      try {
        const data = await apiRequest<{ nome?: string; razao_social?: string }>(
          `/api/cnpj/${digits}`
        );
        setCompanyName(data.nome || data.razao_social || "");
      } catch {
        // silent fail
      } finally {
        setLookupLoading(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await register({
        cnpj,
        password,
        plan,
        faturamento,
        margem,
      });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Crie sua conta PJ" subtitle="Cadastro">
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <Input
          label="CNPJ"
          placeholder="00.000.000/0001-00"
          inputMode="numeric"
          value={cnpj}
          onChange={(e) => handleCnpjChange(e.target.value)}
        />

        {companyName && (
          <div className="bg-blue-50 border border-blue-100 text-blue-800 text-sm rounded-xl px-4 py-3">
            <span className="font-semibold">Empresa encontrada:</span>{" "}
            {companyName}
          </div>
        )}
        {lookupLoading && (
          <p className="text-xs text-gray-400">Buscando dados do CNPJ...</p>
        )}

        <Input
          label="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="Mínimo 8 caracteres"
        />

        <Input
          label="Confirmar senha"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Plano
          </label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          >
            <option value="starter">Starter – R$ 490/mês</option>
            <option value="growth">Growth – R$ 950/mês</option>
            <option value="enterprise">Enterprise – R$ 1.850/mês</option>
          </select>
        </div>

        <Input
          label="Faturamento mensal (R$)"
          placeholder="Ex.: 40.000,00"
          inputMode="decimal"
          value={faturamento}
          onChange={(e) => setFaturamento(e.target.value)}
        />

        <Input
          label="Margem estimada (%)"
          placeholder="Ex.: 12"
          inputMode="decimal"
          value={margem}
          onChange={(e) => setMargem(e.target.value)}
        />

        <Button
          className="w-full"
          loading={loading}
          onClick={handleSubmit}
          disabled={!cnpj || !password || !confirm}
        >
          Criar conta
        </Button>
      </div>

      <p className="text-center text-sm text-gray-500 mt-4">
        Já tem conta?{" "}
        <button
          onClick={onSwitchToLogin}
          className="text-blue-600 font-semibold hover:underline"
        >
          Entrar
        </button>
      </p>
    </Modal>
  );
}
