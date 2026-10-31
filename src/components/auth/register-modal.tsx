"use client";

import { useState, useEffect } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

interface RegisterModalProps {
  open: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
  defaultPlan?: string;
}

const PLAN_DETAILS: Record<string, { name: string; price: string; description: string }> = {
  starter: {
    name: "Starter",
    price: "R$ 490/mês",
    description: "Visão financeira essencial para acompanhar sua operação.",
  },
  growth: {
    name: "Growth",
    price: "R$ 950/mês",
    description: "Simulação fiscal, margem por produto e Open Finance.",
  },
  enterprise: {
    name: "Enterprise",
    price: "R$ 1.850/mês",
    description: "Auditoria, valuation e suporte dedicado para operações maiores.",
  },
};

export function RegisterModal({
  open,
  onClose,
  onSwitchToLogin,
  defaultPlan = "growth",
}: RegisterModalProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [plan, setPlan] = useState(defaultPlan);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdEmail, setCreatedEmail] = useState("");

  const { register } = useAuth();

  useEffect(() => {
    if (open) {
      if (defaultPlan) {
        setPlan(defaultPlan);
      }
      setError("");
      setCreatedEmail("");
    }
  }, [open, defaultPlan]);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("Informe seu e-mail.");
      return;
    }
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
      const response = await register({
        email: email.trim(),
        password,
        name: name.trim(),
        plan,
      });
      if (response.verificationRequired) {
        setCreatedEmail(email.trim());
        return;
      }
      onClose();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Não foi possível criar sua conta.");
    } finally {
      setLoading(false);
    }
  };

  const planDetails = PLAN_DETAILS[plan] || PLAN_DETAILS.growth;

  if (createdEmail) {
    return (
      <Modal open={open} onClose={onClose} title="Confirme seu e-mail" subtitle="Próximo passo">
        <div className="space-y-5">
          <div className="flex items-start gap-4 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
            <div className="rounded-xl bg-blue-500/20 p-2.5 text-blue-300">
              <Mail size={22} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Cadastro recebido</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Enviamos um link de confirmação para <strong>{createdEmail}</strong>. Confirme o endereço para liberar o acesso.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Plano selecionado</p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">{planDetails.name}</p>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">{planDetails.price}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{planDetails.description}</p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck size={15} className="text-emerald-500" />
            Você poderá revisar o plano no onboarding antes de contratar.
          </div>

          <Button className="w-full" onClick={onClose}>Entendi</Button>
          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            Já confirmou?{" "}
            <button onClick={onSwitchToLogin} className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
              Ir para o login
            </button>
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Crie sua conta FinPJ" subtitle="Cadastro">
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 mb-4 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400" role="alert">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Plano escolhido</p>
              <p className="mt-1 font-semibold text-slate-900 dark:text-white">{planDetails.name}</p>
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-white">{planDetails.price}</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{planDetails.description}</p>
        </div>

        <Input
          label="E-mail profissional"
          type="email"
          placeholder="voce@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <Input
          label="Como podemos chamar você? (opcional)"
          placeholder="Seu nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />

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
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
            Plano
          </label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 dark:bg-white/5 dark:border-white/10 dark:text-white"
            aria-label="Selecionar plano"
          >
            <option value="starter">Starter – R$ 490/mês</option>
            <option value="growth">Growth – R$ 950/mês</option>
            <option value="enterprise">Enterprise – R$ 1.850/mês</option>
          </select>
        </div>

        <Button
          className="w-full"
          loading={loading}
          onClick={handleSubmit}
          disabled={!email || !password || !confirm}
        >
          Criar conta
        </Button>
      </div>

      <p className="text-center text-sm text-gray-500 mt-4 dark:text-slate-400">
        Já tem conta?{" "}
        <button
          onClick={onSwitchToLogin}
          className="text-blue-600 font-semibold hover:underline dark:text-blue-400"
        >
          Entrar
        </button>
      </p>
    </Modal>
  );
}
