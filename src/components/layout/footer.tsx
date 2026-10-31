import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-[#10233f] text-white py-16">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center font-bold text-sm">
                F
              </div>
              <span className="text-xl font-bold">FinPJ</span>
            </div>
            <p className="text-blue-200/70 text-sm leading-relaxed">
              Inteligência tributária e financeira para PMEs brasileiras.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-bold text-sm uppercase tracking-wider text-blue-300 mb-4">
              Produto
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="/#como-funciona"
                  className="text-sm text-blue-200/70 hover:text-white transition-colors"
                >
                  Como Funciona
                </a>
              </li>
              <li>
                <a
                  href="/#simulador"
                  className="text-sm text-blue-200/70 hover:text-white transition-colors"
                >
                  Simulador
                </a>
              </li>
              <li>
                <a
                  href="/#planos"
                  className="text-sm text-blue-200/70 hover:text-white transition-colors"
                >
                  Planos
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-bold text-sm uppercase tracking-wider text-blue-300 mb-4">
              Empresa
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="mailto:contato@finpj.com.br"
                  className="text-sm text-blue-200/70 hover:text-white transition-colors"
                >
                  Contato
                </a>
              </li>
              <li>
                <a
                  href="/#faq"
                  className="text-sm text-blue-200/70 hover:text-white transition-colors"
                >
                  Perguntas Frequentes
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold text-sm uppercase tracking-wider text-blue-300 mb-4">
              Legal
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="/termos"
                  className="text-sm text-blue-200/70 hover:text-white transition-colors"
                >
                  Termos de uso
                </a>
              </li>
              <li>
                <a
                  href="/privacidade"
                  className="text-sm text-blue-200/70 hover:text-white transition-colors"
                >
                  Política de privacidade
                </a>
              </li>
              <li>
                <a
                  href="/privacidade#lgpd"
                  className="text-sm text-blue-200/70 hover:text-white transition-colors"
                >
                  LGPD
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 dark:border-white/5">
          <p className="text-sm text-blue-200/50">
            © {new Date().getFullYear()} FinPJ. Todos os direitos reservados.
          </p>
          <p className="text-xs text-blue-200/30">
            Feito com 💙 para empreendedores brasileiros
          </p>
        </div>
      </div>
    </footer>
  );
}
