const LANDING_HEADER_MARKUP = `
  <div class="landing-header-inner">
    <a class="brand landing-brand" href="/" aria-label="FinPJ">
      <img src="/logo.svg" alt="FinPJ" width="132" height="38">
    </a>

    <button class="landing-menu-toggle" type="button" data-mobile-menu-toggle aria-expanded="false"
      aria-controls="landing-menu" aria-label="Abrir menu">
      <span></span>
      <span></span>
      <span></span>
    </button>

    <div class="landing-menu" id="landing-menu" data-mobile-menu>
      <nav class="nav landing-nav" data-main-nav aria-label="Navegacao principal">
        <a href="#solucoes" data-nav-link>Solucoes</a>
        <a href="#resultados" data-nav-link>Resultados</a>
        <a href="#planos" data-nav-link>Planos</a>
        <a href="#faq" data-nav-link>FAQ</a>
        <a href="#contato" data-nav-link>Contato</a>
      </nav>

      <div class="topbar-actions landing-actions">
        <a class="btn btn-ghost landing-action-secondary" href="/login" data-open-login>Entrar</a>
        <a class="btn btn-dark landing-action-primary" href="#solucoes">Simular economia gratis</a>
        <button class="btn btn-ghost is-hidden" type="button" data-logout>Sair</button>
      </div>
    </div>
  </div>
`;

function currentPath() {
  const normalized = window.location.pathname.replace(/\/+$/, '');
  return normalized || '/';
}

function isOnboardingPath(path) {
  return [
    '/onboarding/verificar-email',
    '/onboarding/perfil',
    '/onboarding/plano',
    '/onboarding/template',
    '/onboarding/checklist',
    '/onboarding/primeiro-valor'
  ].includes(path);
}

function isAuthPath(path) {
  return [
    '/login',
    '/cadastro',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/dashboard',
    '/auth/callback/google',
    '/auth/callback/github'
  ].includes(path);
}

function buildFlowHeader(path) {
  const primaryHref = path === '/login' ? '/cadastro' : '/login';
  const primaryLabel = path === '/login' ? 'Criar conta' : 'Entrar';
  const primaryAttr = path === '/login' ? 'data-open-register' : 'data-open-login';

  return `
    <div class="landing-header-inner landing-header-inner-compact">
      <a class="brand landing-brand" href="/" aria-label="FinPJ">
        <img src="/logo.svg" alt="FinPJ" width="132" height="38">
      </a>

      <div class="landing-flow-header-actions">
        <a class="btn btn-ghost" href="/">Voltar ao simulador</a>
        <a class="btn btn-dark" href="${primaryHref}" ${primaryAttr}>${primaryLabel}</a>
        <button class="btn btn-ghost is-hidden" type="button" data-logout>Sair</button>
      </div>
    </div>
  `;
}

function buildFlowLayout(meta = {}) {
  const progress = meta.stepNumber && meta.totalSteps
    ? `
        <div class="landing-flow-progress" aria-label="Progresso do onboarding">
          <div class="landing-flow-progress-copy">
            <span>Etapa ${meta.stepNumber} de ${meta.totalSteps}</span>
            <strong>${meta.progressLabel || meta.title}</strong>
          </div>
          <div class="landing-flow-progress-track">
            <span style="width:${Math.max(8, Math.round((meta.stepNumber / meta.totalSteps) * 100))}%;"></span>
          </div>
        </div>
      `
    : '';

  const asidePoints = (meta.points || [])
    .map((point) => `<li>${point}</li>`)
    .join('');

  const badges = (meta.badges || [])
    .map((badge) => `<span>${badge}</span>`)
    .join('');

  return `
    <section class="landing-section landing-flow-shell">
      <div class="landing-flow-grid">
        <aside class="landing-flow-aside" data-reveal>
          ${progress}
          <p class="landing-badge">${meta.eyebrow || 'FINPJ'}</p>
          <h1>${meta.title || ''}</h1>
          <p class="landing-hero-text">${meta.copy || ''}</p>
          ${badges ? `<div class="landing-trust-notes landing-trust-notes-compact">${badges}</div>` : ''}
          ${asidePoints ? `<ul class="landing-flow-points">${asidePoints}</ul>` : ''}
          ${meta.helper || ''}
        </aside>

        <div class="landing-flow-card" data-reveal>
          ${meta.cardHeader || ''}
          ${meta.form || ''}
          ${meta.footer || ''}
        </div>
      </div>
    </section>
  `;
}

function buildLoginMarkup() {
  return buildFlowLayout({
    eyebrow: 'ACESSO AO WORKSPACE',
    title: 'Entre do jeito que faz sentido para a sua operacao',
    copy: 'Use email e senha, codigo por email, CNPJ ou SSO. Nada muda no backend legado; a pagina so organiza melhor os caminhos existentes.',
    badges: ['Auth0 SSO ativo', 'JWT com expiracao', 'Sem tela morta'],
    points: [
      'Auth0 segue como rota principal de SSO.',
      'Google e GitHub aparecem com degradacao segura se nao estiverem configurados.',
      'Fluxos legados por codigo e CNPJ continuam disponiveis.'
    ],
    cardHeader: `
      <div class="landing-card-heading">
        <span class="landing-chip">Entrar</span>
        <h3>Acesse sua conta FinPJ</h3>
      </div>
    `,
    form: `
      <form class="landing-flow-form" data-login-password-form>
        <label>E-mail corporativo
          <input type="email" data-route-login-email placeholder="voce@empresa.com" autocomplete="email" required>
        </label>
        <label>Senha
          <input type="password" data-route-login-password autocomplete="current-password" required>
        </label>
        <button class="btn btn-dark full" type="submit">Entrar com email e senha</button>
        <div class="landing-inline-links">
          <a href="/forgot-password">Esqueci minha senha</a>
          <a href="/cadastro">Criar conta</a>
        </div>
        <p class="form-note" data-login-password-note></p>
      </form>

      <div class="landing-oauth-grid">
        <button class="btn btn-light" type="button" data-oauth-button="google">Continuar com Google</button>
        <button class="btn btn-light" type="button" data-oauth-button="github">Continuar com GitHub</button>
      </div>
      <a class="auth0-btn" href="/api/auth/auth0/login" data-auth0-login>
        <span class="auth0-mark">A0</span>
        Entrar com Auth0
      </a>
      <p class="form-note" data-route-oauth-note></p>

      <div class="landing-flow-divider"><span>Ou use um fluxo legado</span></div>

      <div class="landing-legacy-grid">
        <form class="landing-flow-form landing-legacy-card" data-route-code-form>
          <strong>Codigo por e-mail</strong>
          <label>E-mail
            <input type="email" data-route-code-email data-login-email placeholder="voce@empresa.com" autocomplete="email">
          </label>
          <div class="landing-inline-actions">
            <button class="btn btn-light" type="button" data-route-send-code>Enviar codigo</button>
            <button class="btn btn-dark" type="submit">Validar codigo</button>
          </div>
          <label>Codigo
            <input data-route-code-input data-login-code inputmode="numeric" placeholder="000000" autocomplete="one-time-code">
          </label>
          <p class="form-note" data-route-code-note></p>
        </form>

        <form class="landing-flow-form landing-legacy-card" data-route-cnpj-form>
          <strong>Entrar com CNPJ</strong>
          <label>CNPJ
            <input data-route-login-cnpj data-login-cnpj inputmode="numeric" placeholder="00.000.000/0001-00" autocomplete="username">
          </label>
          <label>Senha
            <input type="password" data-route-login-cnpj-password data-login-password autocomplete="current-password">
          </label>
          <button class="btn btn-dark full" type="submit">Entrar com CNPJ</button>
          <p class="form-note" data-route-cnpj-note></p>
        </form>
      </div>
    `
  });
}

function buildSignupMarkup() {
  return buildFlowLayout({
    eyebrow: 'COMECE PELO DIAGNOSTICO',
    title: 'Crie a conta e descubra antes de pagar onde esta a perda financeira',
    copy: 'A rota principal agora e email-first, com consentimento explicito, sem bloquear o simulador e sem remover o fluxo rapido legado por CNPJ.',
    badges: ['LGPD visivel', 'Sem cartao', 'Retomada por onboarding'],
    points: [
      'Primeiro valor vem antes de qualquer cobranca.',
      'Plano e caso de uso ficam no onboarding, nao na parede de pagamento.',
      'O fluxo rapido antigo continua disponivel para quem prefere checkout imediato.'
    ],
    cardHeader: `
      <div class="landing-card-heading">
        <span class="landing-chip">Cadastro</span>
        <h3>Abra sua conta FinPJ</h3>
      </div>
    `,
    form: `
      <form class="landing-flow-form" data-register-account-form>
        <label>Nome
          <input type="text" data-route-register-name placeholder="Seu nome">
        </label>
        <label>E-mail corporativo
          <input type="email" data-route-register-email placeholder="voce@empresa.com" autocomplete="email" required>
        </label>
        <label>Senha
          <input type="password" data-route-register-password autocomplete="new-password" required>
        </label>
        <label>Confirmar senha
          <input type="password" data-route-register-confirm autocomplete="new-password" required>
        </label>
        <label>Como voce vai usar o FinPJ?
          <select data-route-register-usage>
            <option value="">Selecione</option>
            <option value="founder">Sou socio ou dono da empresa</option>
            <option value="finance">Sou financeiro/controladoria</option>
            <option value="accountant">Sou contador ou consultor</option>
          </select>
        </label>
        <label class="landing-check">
          <input type="checkbox" data-route-register-consent required>
          <span>Autorizo o uso dos meus dados para criar a conta, consultar dados publicos do CNPJ e gerar meu diagnostico inicial.</span>
        </label>
        <button class="btn btn-dark full" type="submit">Criar conta gratuita</button>
        <p class="form-note" data-register-account-note></p>
      </form>

      <div class="landing-oauth-grid">
        <button class="btn btn-light" type="button" data-oauth-button="google" data-oauth-mode="signup">Cadastrar com Google</button>
        <button class="btn btn-light" type="button" data-oauth-button="github" data-oauth-mode="signup">Cadastrar com GitHub</button>
      </div>
      <p class="form-note" data-route-oauth-note></p>

      <div class="landing-flow-divider"><span>Fluxo legado opcional</span></div>

      <form class="landing-flow-form landing-legacy-card" data-register-legacy-form>
        <strong>Cadastro rapido com CNPJ + checkout</strong>
        <label>CNPJ
          <input data-route-register-cnpj data-register-cnpj inputmode="numeric" placeholder="00.000.000/0001-00" required>
        </label>
        <div class="company-preview" data-route-register-cnpj-preview data-cnpj-result data-company-preview>Digite o CNPJ para buscar os dados publicos da empresa.</div>
        <label>Senha
          <input type="password" data-route-register-legacy-password data-register-password autocomplete="new-password" required>
        </label>
        <label>Confirmar senha
          <input type="password" data-route-register-legacy-confirm data-register-confirm autocomplete="new-password" required>
        </label>
        <label>Plano
          <select data-route-register-plan data-register-plan>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </label>
        <label>Faturamento mensal (R$)
          <input data-route-register-faturamento data-register-faturamento inputmode="decimal" placeholder="Ex.: 40.000,00" required>
        </label>
        <label>Margem estimada (%)
          <input data-route-register-margem data-register-margem inputmode="decimal" placeholder="Ex.: 12" required>
        </label>
        <label class="landing-check">
          <input type="checkbox" data-route-register-legacy-consent required>
          <span>Autorizo o uso dos dados para validar CNPJ, criar a conta e iniciar o checkout do plano escolhido.</span>
        </label>
        <button class="btn btn-light full" type="submit">Criar conta pelo fluxo rapido</button>
        <p class="form-note" data-register-legacy-note></p>
      </form>
    `
  });
}

function buildForgotPasswordMarkup() {
  return buildFlowLayout({
    eyebrow: 'RECUPERAR ACESSO',
    title: 'Receba um link seguro para redefinir sua senha',
    copy: 'O link de recuperacao respeita expiracao de token e nao revela se o e-mail existe ou nao na base.',
    badges: ['Link com expiracao', 'Sem stack trace', 'Brevo/Nodemailer'],
    form: `
      <div class="landing-card-heading">
        <span class="landing-chip">Recuperacao</span>
        <h3>Esqueci minha senha</h3>
      </div>
      <form class="landing-flow-form" data-forgot-password-form>
        <label>E-mail corporativo
          <input type="email" data-route-forgot-email placeholder="voce@empresa.com" autocomplete="email" required>
        </label>
        <button class="btn btn-dark full" type="submit">Enviar link de recuperacao</button>
        <p class="form-note" data-forgot-password-note></p>
      </form>
    `
  });
}

function buildResetPasswordMarkup() {
  return buildFlowLayout({
    eyebrow: 'NOVA SENHA',
    title: 'Crie uma nova senha e retome seu workspace',
    copy: 'Se o token estiver expirado ou invalido, a tela orienta o usuario a solicitar um novo link sem cair em erro interno.',
    badges: ['Token validado', 'Mensagem amigavel', 'Sessao renovada no sucesso'],
    form: `
      <div class="landing-card-heading">
        <span class="landing-chip">Redefinir senha</span>
        <h3>Escolha uma nova senha</h3>
      </div>
      <form class="landing-flow-form" data-reset-password-form>
        <label>Nova senha
          <input type="password" data-route-reset-password autocomplete="new-password" required>
        </label>
        <label>Confirmar nova senha
          <input type="password" data-route-reset-confirm autocomplete="new-password" required>
        </label>
        <button class="btn btn-dark full" type="submit">Salvar nova senha</button>
        <p class="form-note" data-reset-password-note></p>
      </form>
    `
  });
}

function buildVerifyEmailMarkup() {
  return buildFlowLayout({
    eyebrow: 'ONBOARDING',
    title: 'Confirme seu e-mail para liberar o restante da jornada',
    copy: 'Sem verificacao o usuario nao entra em limbo: ele ve o status do link, o email usado e quando pode reenviar.',
    badges: ['Etapa obrigatoria', 'Cooldown de reenvio', 'Retomada automatica'],
    points: [
      'Se o link chegar pronto, a verificacao roda automaticamente.',
      'Se o link expirar, o reenvio aparece na mesma tela.',
      'Ao concluir, o usuario segue para perfil sem precisar adivinhar o proximo passo.'
    ],
    stepNumber: 1,
    totalSteps: 6,
    progressLabel: 'Verificacao de e-mail',
    form: `
      <div class="landing-card-heading">
        <span class="landing-chip">Verificacao</span>
        <h3>Ative sua conta</h3>
      </div>
      <div class="landing-status-card">
        <strong data-verify-email-status>Aguardando validacao do link.</strong>
        <p data-verify-email-note>Abra o e-mail de boas-vindas e clique em confirmar.</p>
        <small>E-mail atual: <span data-verify-email-address>nao informado</span></small>
      </div>
      <div class="landing-inline-actions landing-inline-actions-wrap">
        <button class="btn btn-light" type="button" data-resend-verification>Reenviar e-mail</button>
        <a class="btn btn-ghost" href="/login">Ja confirmei, tentar login</a>
      </div>
      <small class="form-note" data-resend-countdown></small>
    `
  });
}

function buildProfileMarkup() {
  return buildFlowLayout({
    eyebrow: 'ONBOARDING',
    title: 'Personalize o workspace antes do primeiro diagnostico',
    copy: 'Essa etapa alimenta mensagens, templates e recomendacoes sem tocar nas estruturas criticas do backend.',
    badges: ['Etapa 2 de 6', 'Sem API nova', 'Dados persistidos'],
    stepNumber: 2,
    totalSteps: 6,
    progressLabel: 'Perfil',
    form: `
      <div class="landing-card-heading">
        <span class="landing-chip">Perfil</span>
        <h3>Como o FinPJ deve falar com voce?</h3>
      </div>
      <form class="landing-flow-form" data-onboarding-profile-form>
        <label>Nome
          <input type="text" data-onboarding-name placeholder="Seu nome" required>
        </label>
        <label>Foto (URL opcional)
          <input type="url" data-onboarding-avatar placeholder="https://...">
        </label>
        <fieldset class="landing-choice-fieldset">
          <legend>Tipo de uso</legend>
          <label class="landing-choice-line">
            <input type="radio" name="usageType" value="founder">
            <span>Serei o dono/socio usando no dia a dia</span>
          </label>
          <label class="landing-choice-line">
            <input type="radio" name="usageType" value="finance">
            <span>Sou financeiro, controladoria ou operacao</span>
          </label>
          <label class="landing-choice-line">
            <input type="radio" name="usageType" value="accountant">
            <span>Sou contador ou parceiro da empresa</span>
          </label>
        </fieldset>
        <button class="btn btn-dark full" type="submit">Salvar e continuar</button>
        <p class="form-note" data-onboarding-profile-note></p>
      </form>
    `
  });
}

function buildPlanMarkup() {
  return buildFlowLayout({
    eyebrow: 'ONBOARDING',
    title: 'Escolha o ritmo de acompanhamento sem muro de pagamento',
    copy: 'O Freemium fica visivel e destacado. A decisao comercial nao bloqueia o primeiro valor do produto.',
    badges: ['Etapa 3 de 6', 'Freemium em destaque', 'Sem checkout nesta etapa'],
    stepNumber: 3,
    totalSteps: 6,
    progressLabel: 'Plano',
    form: `
      <div class="landing-card-heading">
        <span class="landing-chip">Plano</span>
        <h3>Comece pelo nivel de acompanhamento que faz sentido hoje</h3>
      </div>
      <div class="landing-choice-grid">
        <button class="landing-choice-card is-featured" type="button" data-onboarding-plan="freemium">
          <span class="landing-price-badge">Mais leve</span>
          <strong>Freemium</strong>
          <p>Simulador, diagnostico inicial e onboarding completo antes de falar de cobranca.</p>
        </button>
        <button class="landing-choice-card" type="button" data-onboarding-plan="starter">
          <strong>Starter</strong>
          <p>R$ 490/mês para DRE gerencial, alertas de custos e visao executiva mensal.</p>
        </button>
        <button class="landing-choice-card" type="button" data-onboarding-plan="growth">
          <strong>Growth</strong>
          <p>R$ 950/mês para simulacao fiscal, margem por produto e follow-up mais proximo.</p>
        </button>
        <button class="landing-choice-card" type="button" data-onboarding-plan="enterprise">
          <strong>Enterprise</strong>
          <p>R$ 1.850/mês para times com mais volume, multi-CNPJ e aprofundamento recorrente.</p>
        </button>
      </div>
      <p class="form-note" data-onboarding-plan-note></p>
    `
  });
}

function buildTemplateMarkup() {
  return buildFlowLayout({
    eyebrow: 'ONBOARDING',
    title: 'Escolha qual caso de uso deve aparecer primeiro no seu dashboard',
    copy: 'Em vez de deixar o usuario cair em um dashboard vazio, o template inicial define o contexto da primeira analise.',
    badges: ['Etapa 4 de 6', 'Contexto inicial', 'Sem branch de backend'],
    stepNumber: 4,
    totalSteps: 6,
    progressLabel: 'Template inicial',
    form: `
      <div class="landing-card-heading">
        <span class="landing-chip">Template</span>
        <h3>Qual problema voce quer enxergar primeiro?</h3>
      </div>
      <div class="landing-choice-grid">
        <button class="landing-choice-card" type="button" data-onboarding-template="tax-diagnostic">
          <strong>Diagnostico tributario</strong>
          <p>Comparar regime atual, estimar economia e abrir prioridades fiscais.</p>
        </button>
        <button class="landing-choice-card" type="button" data-onboarding-template="cash-clarity">
          <strong>Clareza de caixa</strong>
          <p>Entender receita, saidas e onde o caixa esta sendo comprimido.</p>
        </button>
        <button class="landing-choice-card" type="button" data-onboarding-template="multi-company">
          <strong>Multi-CNPJ</strong>
          <p>Organizar mais de uma empresa no mesmo workspace.</p>
        </button>
        <button class="landing-choice-card" type="button" data-onboarding-template="accounting-partner">
          <strong>Contador parceiro</strong>
          <p>Estruturar uma visao para conduzir clientes com mais clareza executiva.</p>
        </button>
      </div>
      <p class="form-note" data-onboarding-template-note></p>
    `
  });
}

function buildChecklistMarkup() {
  return buildFlowLayout({
    eyebrow: 'ONBOARDING',
    title: 'Deixe claro o proximo passo antes de abrir o dashboard',
    copy: 'O checklist gamificado reduz abandono e explica o valor de conectar banco sem transformar Pluggy em gargalo.',
    badges: ['Etapa 5 de 6', 'Checklist claro', 'Open Finance opcional'],
    stepNumber: 5,
    totalSteps: 6,
    progressLabel: 'Checklist',
    form: `
      <div class="landing-card-heading">
        <span class="landing-chip">Checklist</span>
        <h3>Voce esta a uma etapa do primeiro diagnostico</h3>
      </div>
      <div class="landing-checklist-shell">
        <div class="landing-checklist-list" data-onboarding-checklist-items></div>
      </div>
      <div class="landing-inline-actions landing-inline-actions-wrap">
        <button class="btn btn-dark" type="button" data-checklist-continue>Ir para meu primeiro valor</button>
        <a class="btn btn-ghost" href="/dashboard">Pular e abrir dashboard</a>
      </div>
      <p class="form-note" data-onboarding-checklist-note>Conectar banco agora e opcional. O fluxo segue mesmo sem Open Finance.</p>
    `
  });
}

function buildFirstValueMarkup() {
  return buildFlowLayout({
    eyebrow: 'ONBOARDING',
    title: 'Gere um diagnostico real antes de pedir qualquer integracao pesada',
    copy: 'Aqui o usuario informa o CNPJ, confirma as premissas e ja recebe comparacao de regime para chegar no dashboard com contexto.',
    badges: ['Etapa 6 de 6', 'CNPJ com autofill', 'Primeiro valor antes de pagar'],
    stepNumber: 6,
    totalSteps: 6,
    progressLabel: 'Primeiro valor',
    form: `
      <div class="landing-card-heading">
        <span class="landing-chip">Primeiro valor</span>
        <h3>Gere sua primeira comparacao tributaria</h3>
      </div>
      <div class="simulator-grid landing-simulator-grid landing-simulator-grid-stack">
        <form class="simulator-card landing-simulator-form" data-public-diagnostic-form>
          <label>CNPJ
            <input name="cnpj" inputmode="numeric" placeholder="00.000.000/0001-00" maxlength="18" data-cnpj-input required>
          </label>

          <div class="company-info" data-company-info style="display:none;">
            <div class="info-row"><span>Razao Social</span><strong data-company-nome></strong></div>
            <div class="info-row"><span>CNAE Principal</span><strong data-company-cnae></strong></div>
            <div class="info-row"><span>Atividade Detectada</span><strong data-company-atividade></strong></div>
          </div>

          <input type="hidden" name="atividade" data-atividade-input value="comercio">

          <label>Faturamento anual (R$)
            <input name="faturamento" inputmode="decimal" placeholder="480.000,00" data-currency-input required>
          </label>

          <label>Margem estimada (%)
            <input name="margem" inputmode="decimal" placeholder="12" data-percent-input required>
          </label>

          <label>Regime atual (opcional)
            <select name="regime_atual">
              <option value="">Nao informado</option>
              <option value="simples">Simples Nacional</option>
              <option value="presumido">Lucro Presumido</option>
              <option value="real">Lucro Real</option>
            </select>
          </label>

          <label class="landing-check">
            <input type="checkbox" data-first-value-consent required>
            <span>Autorizo a consulta de dados publicos do CNPJ e o uso das premissas acima para gerar meu diagnostico inicial.</span>
          </label>

          <button class="btn btn-dark full" type="submit" data-public-simulate-button disabled>Gerar comparacao agora</button>
          <button class="btn btn-light full" type="button" data-complete-first-value disabled>Salvar empresa e abrir dashboard</button>
          <p class="form-note" data-first-value-note></p>
        </form>

        <article class="simulator-card simulator-result landing-simulator-result">
          <div class="landing-card-heading">
            <span class="landing-chip">Resultado da analise</span>
            <h3>Melhor opcao estimada</h3>
          </div>
          <strong data-public-best-regime>Aguardando CNPJ</strong>
          <p data-public-diagnostic-copy>Preencha os dados para visualizar uma comparacao tributaria previa.</p>
          <small class="simulator-result-status" data-public-simulator-status>Digite o CNPJ para liberar a analise.</small>
          <div class="simulator-readiness" data-public-simulator-checks>
            <span data-check="cnpj">CNPJ pendente</span>
            <span data-check="premissas">Premissas pendentes</span>
            <span data-check="atividade">Atividade a detectar</span>
          </div>
          <div class="regime-comparison" data-regime-comparison></div>
        </article>
      </div>
    `
  });
}

function buildCallbackMarkup(providerLabel) {
  return buildFlowLayout({
    eyebrow: 'AUTENTICACAO',
    title: `Concluindo acesso com ${providerLabel}`,
    copy: 'Se a autenticacao ja terminou no backend, esta tela so existe para evitar rota vazia e orientar o usuario.',
    badges: ['Callback tratado', 'Sem tela em branco'],
    form: `
      <div class="landing-card-heading">
        <span class="landing-chip">Callback</span>
        <h3>Processando autenticacao</h3>
      </div>
      <div class="landing-status-card">
        <strong>Aguarde alguns instantes.</strong>
        <p data-callback-note>Se nada acontecer, volte para o login e tente novamente.</p>
      </div>
      <div class="landing-inline-actions">
        <a class="btn btn-light" href="/login">Voltar ao login</a>
      </div>
    `
  });
}

function buildDashboardGateMarkup() {
  return buildFlowLayout({
    eyebrow: 'WORKSPACE',
    title: 'Entre para abrir seu dashboard financeiro',
    copy: 'A rota /dashboard continua disponivel, mas o acesso sem sessao valida volta para um CTA claro em vez de uma tela vazia.',
    badges: ['Rota preservada', '401 amigavel'],
    form: `
      <div class="landing-card-heading">
        <span class="landing-chip">Dashboard</span>
        <h3>Sessao necessaria</h3>
      </div>
      <div class="landing-status-card">
        <strong>Seu workspace FinPJ exige autenticacao valida.</strong>
        <p>Entre com email, CNPJ, codigo ou SSO para continuar.</p>
      </div>
      <div class="landing-inline-actions landing-inline-actions-wrap">
        <a class="btn btn-dark" href="/login">Entrar agora</a>
        <a class="btn btn-ghost" href="/">Voltar ao simulador gratuito</a>
      </div>
    `
  });
}

function buildLandingMarkup() {
  return `
    <section id="home" class="landing-hero">
      <div class="landing-hero-shell">
        <div class="landing-hero-copy" data-reveal>
          <p class="landing-badge">SIMULADOR FISCAL E FINANCEIRO PARA PMES</p>
          <h1>Descubra em minutos se a sua empresa esta pagando imposto acima do necessario</h1>
          <p class="landing-hero-text">O FinPJ cruza CNPJ, regime atual, faturamento e margem para estimar economia tributaria, explicar a pressao no caixa e mostrar o proximo passo antes da demo.</p>

          <div class="hero-actions landing-hero-actions">
            <a class="btn btn-dark btn-lg landing-cta-primary" href="#solucoes">Rodar simulacao gratuita</a>
            <a class="btn btn-light btn-lg landing-cta-secondary" href="/cadastro">Criar conta sem cartao</a>
          </div>

          <div class="landing-trust-notes" aria-label="Sinais de confianca">
            <span>LGPD com consentimento explicito</span>
            <span>Open Finance via Pluggy</span>
            <span>Sem cartao no primeiro valor</span>
            <span>Dados so com sua autorizacao</span>
          </div>
        </div>

        <aside class="landing-dashboard-showcase" aria-label="Previa do dashboard FinPJ" data-reveal>
          <div class="landing-dashboard-glow" aria-hidden="true"></div>
          <div class="landing-dashboard-frame">
            <div class="landing-dashboard-sidebar-preview">
              <a class="landing-dashboard-brand" href="/" aria-label="FinPJ">
                <img src="/logo.svg" alt="FinPJ" width="108" height="30">
              </a>
              <nav class="landing-dashboard-menu" aria-label="Menu do dashboard">
                <span class="is-active">Visao Geral</span>
                <span>Simulacoes</span>
                <span>Relatorios</span>
                <span>Insights</span>
                <span>Documentos</span>
                <span>Open Finance</span>
              </nav>
            </div>

            <div class="landing-dashboard-main">
              <div class="landing-dashboard-topbar">
                <div>
                  <strong>Empresa Exemplo LTDA</strong>
                  <small>12.345.678/0001-90</small>
                </div>
                <span class="landing-dashboard-chip">Diagnostico atualizado</span>
              </div>

              <div class="landing-dashboard-kpis">
                <article class="landing-mini-metric">
                  <span>Economia anual estimada</span>
                  <strong>R$ 98.540</strong>
                </article>
                <article class="landing-mini-metric">
                  <span>Melhor regime</span>
                  <strong>Lucro Presumido</strong>
                </article>
                <article class="landing-mini-metric">
                  <span>Imposto atual</span>
                  <strong>R$ 256.420</strong>
                </article>
                <article class="landing-mini-metric">
                  <span>Novo imposto</span>
                  <strong>R$ 157.880</strong>
                </article>
              </div>

              <div class="landing-dashboard-chart-grid">
                <article class="landing-chart-card">
                  <div class="landing-chart-header">
                    <div>
                      <strong>Comparativo tributario</strong>
                      <small>12 meses</small>
                    </div>
                    <span class="landing-chart-pill">-38,4%</span>
                  </div>
                  <svg class="landing-line-chart" viewBox="0 0 420 180" role="img"
                    aria-label="Grafico comparativo entre imposto atual e novo imposto">
                    <defs>
                      <linearGradient id="lineFillCurrent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#00D4FF" stop-opacity="0.28"></stop>
                        <stop offset="100%" stop-color="#00D4FF" stop-opacity="0"></stop>
                      </linearGradient>
                    </defs>
                    <path d="M16 145 L16 24" class="landing-axis"></path>
                    <path d="M16 145 L404 145" class="landing-axis"></path>
                    <path d="M24 108 C62 94, 92 86, 118 92 S174 110, 210 114 S278 100, 312 88 S366 64, 396 52"
                      class="landing-line landing-line-current"></path>
                    <path d="M24 132 C62 126, 92 120, 118 118 S174 112, 210 106 S278 90, 312 80 S366 66, 396 58"
                      class="landing-line landing-line-best"></path>
                    <path d="M24 132 C62 126, 92 120, 118 118 S174 112, 210 106 S278 90, 312 80 S366 66, 396 58 L396 145 L24 145 Z"
                      fill="url(#lineFillCurrent)"></path>
                  </svg>
                  <div class="landing-chart-legend">
                    <span><i class="legend-current"></i>Imposto atual</span>
                    <span><i class="legend-best"></i>Novo cenario</span>
                  </div>
                </article>

                <article class="landing-chart-card landing-donut-card">
                  <div class="landing-chart-header">
                    <div>
                      <strong>Impacto no caixa</strong>
                      <small>Receita anual</small>
                    </div>
                  </div>
                  <div class="landing-donut-wrap">
                    <svg class="landing-donut-chart" viewBox="0 0 180 180" role="img"
                      aria-label="Distribuicao do impacto financeiro por categoria">
                      <circle cx="90" cy="90" r="54" class="landing-donut-track"></circle>
                      <circle cx="90" cy="90" r="54" class="landing-donut-segment landing-donut-primary"
                        stroke-dasharray="210 339" stroke-dashoffset="0"></circle>
                      <circle cx="90" cy="90" r="54" class="landing-donut-segment landing-donut-secondary"
                        stroke-dasharray="78 339" stroke-dashoffset="-216"></circle>
                      <circle cx="90" cy="90" r="54" class="landing-donut-segment landing-donut-tertiary"
                        stroke-dasharray="42 339" stroke-dashoffset="-300"></circle>
                    </svg>
                    <div class="landing-donut-center">
                      <strong>R$ 157.880</strong>
                      <span>Novo imposto</span>
                    </div>
                  </div>
                  <div class="landing-donut-legend">
                    <span><i class="legend-current"></i>Tributos diretos</span>
                    <span><i class="legend-best"></i>Caixa preservado</span>
                    <span><i class="legend-neutral"></i>Operacao</span>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>

    <section class="landing-section landing-metrics" aria-label="Indicadores principais" data-reveal>
      <div class="landing-metrics-grid">
        <article class="landing-stat-card">
          <strong>+2.500</strong>
          <span>Empresas analisadas</span>
        </article>
        <article class="landing-stat-card">
          <strong>R$ 45M+</strong>
          <span>Economia potencial mapeada</span>
        </article>
        <article class="landing-stat-card">
          <strong>12 min</strong>
          <span>Tempo medio para o primeiro diagnostico</span>
        </article>
        <article class="landing-stat-card">
          <strong>3 modulos</strong>
          <span>Tributario, DRE e monitor de custos</span>
        </article>
      </div>
    </section>

    <section id="resultados" class="landing-section landing-proof-section">
      <div class="landing-section-heading" data-reveal>
        <p class="eyebrow landing-eyebrow">Resultados tipicos</p>
        <h2>O que o FinPJ ajuda a revelar antes da reuniao comercial</h2>
        <p>Os cards abaixo sao casos ilustrativos para explicar ROI. Substitua por depoimentos aprovados assim que o time comercial liberar quotes reais.</p>
      </div>

      <div class="landing-proof-grid">
        <article class="landing-proof-card" data-reveal>
          <span class="landing-chip">Caso ilustrativo</span>
          <strong>Distribuidora alimenticia</strong>
          <p>Faturamento anual de R$ 6,8 mi. O simulador apontou economia potencial de R$ 118 mil/ano ao comparar o regime atual com Lucro Presumido.</p>
        </article>
        <article class="landing-proof-card" data-reveal>
          <span class="landing-chip">Caso ilustrativo</span>
          <strong>Clinica multiprofissional</strong>
          <p>Com receita anual de R$ 3,2 mi, o diagnostico inicial mostrou pressao tributaria e financeira equivalente a R$ 64 mil/ano em margem comprimida.</p>
        </article>
        <article class="landing-proof-card" data-reveal>
          <span class="landing-chip">Caso ilustrativo</span>
          <strong>Grupo com 3 CNPJs</strong>
          <p>Ao organizar empresas em um unico workspace, o time ganhou visao consolidada de caixa e abriu trilha para recuperacao de creditos com success fee.</p>
        </article>
      </div>
    </section>

    <section id="solucoes" class="landing-section landing-product-section">
      <div class="landing-section-heading" data-reveal>
        <p class="eyebrow landing-eyebrow">Simulador gratuito</p>
        <h2>Teste sua empresa antes de criar conta</h2>
        <p>Informe o CNPJ, confirme faturamento e margem e veja qual regime parece mais eficiente antes de conectar banco ou pagar qualquer plano.</p>
      </div>

      <div class="landing-product-grid">
        <article class="landing-product-card" data-reveal>
          <div class="landing-product-card-header">
            <span class="landing-chip">O que o FinPJ entrega</span>
            <h3>Primeiro valor em poucos minutos</h3>
          </div>
          <div class="landing-product-feature-list">
            <div>
              <strong>Diagnostico tributario inicial</strong>
              <p>Compare Simples, Lucro Presumido e Lucro Real no contexto da sua empresa.</p>
            </div>
            <div>
              <strong>Leitura executiva de caixa</strong>
              <p>Entenda como a carga tributaria encosta no resultado e no caixa antes de aprofundar integracoes.</p>
            </div>
            <div>
              <strong>Continuidade no dashboard</strong>
              <p>Entre na plataforma e evolua para Open Finance, DRE, IA documental e multi-CNPJ quando fizer sentido.</p>
            </div>
          </div>
        </article>

        <div class="simulator-grid landing-simulator-grid" data-reveal>
          <form class="simulator-card landing-simulator-form" data-public-diagnostic-form>
            <div class="landing-card-heading">
              <span class="landing-chip">Simulacao publica</span>
              <h3>Rodar simulacao agora</h3>
            </div>

            <label>CNPJ
              <input name="cnpj" inputmode="numeric" placeholder="00.000.000/0001-00" maxlength="18" data-cnpj-input>
            </label>

            <div class="company-info" data-company-info style="display:none;">
              <div class="info-row"><span>Razao Social</span><strong data-company-nome></strong></div>
              <div class="info-row"><span>CNAE Principal</span><strong data-company-cnae></strong></div>
              <div class="info-row"><span>Atividade Detectada</span><strong data-company-atividade></strong></div>
            </div>

            <input type="hidden" name="atividade" data-atividade-input value="comercio">

            <label>Faturamento anual (R$)
              <input name="faturamento" inputmode="decimal" placeholder="480.000,00" data-currency-input>
            </label>

            <label>Margem estimada (%)
              <input name="margem" inputmode="decimal" placeholder="12" data-percent-input>
            </label>

            <label>Regime atual (opcional)
              <select name="regime_atual">
                <option value="">Nao informado</option>
                <option value="simples">Simples Nacional</option>
                <option value="presumido">Lucro Presumido</option>
                <option value="real">Lucro Real</option>
              </select>
            </label>

            <button class="btn btn-dark full landing-simulate-button" type="submit" data-public-simulate-button
              disabled>Gerar simulacao agora</button>
          </form>

          <article class="simulator-card simulator-result landing-simulator-result">
            <div class="landing-card-heading">
              <span class="landing-chip">Resultado da analise</span>
              <h3>Melhor opcao estimada</h3>
            </div>
            <strong data-public-best-regime>Aguardando CNPJ</strong>
            <p data-public-diagnostic-copy>Preencha os dados para visualizar uma comparacao tributaria previa.</p>
            <small class="simulator-result-status" data-public-simulator-status>Digite o CNPJ para liberar a analise.</small>
            <div class="simulator-readiness" data-public-simulator-checks>
              <span data-check="cnpj">CNPJ pendente</span>
              <span data-check="premissas">Premissas pendentes</span>
              <span data-check="atividade">Atividade a detectar</span>
            </div>
            <div class="regime-comparison" data-regime-comparison></div>
          </article>
        </div>
      </div>
    </section>

    <section class="landing-section landing-steps-section">
      <div class="landing-section-heading" data-reveal>
        <p class="eyebrow landing-eyebrow">Como funciona</p>
        <h2>Uma jornada curta ate o primeiro insight</h2>
        <p>O funil agora empurra para diagnostico gratuito, depois onboarding claro e so entao aprofunda plano, integracao bancaria e rotina de controladoria.</p>
      </div>

      <div class="landing-steps-grid">
        <article class="landing-step-card" data-reveal>
          <span class="landing-step-number">1</span>
          <h3>Rodar simulacao</h3>
          <p>Consultar o CNPJ e validar rapidamente se existe economia potencial no regime tributario atual.</p>
        </article>
        <article class="landing-step-card" data-reveal>
          <span class="landing-step-number">2</span>
          <h3>Entrar no onboarding</h3>
          <p>Verificar e-mail, escolher contexto de uso, definir plano e template sem cair em dashboard vazio.</p>
        </article>
        <article class="landing-step-card" data-reveal>
          <span class="landing-step-number">3</span>
          <h3>Evoluir para operacao</h3>
          <p>Conectar bancos, subir documentos e acompanhar indicadores de caixa, margem e tributos.</p>
        </article>
      </div>
    </section>

    <section id="planos" class="landing-section landing-pricing-section">
      <div class="landing-section-heading" data-reveal>
        <p class="eyebrow landing-eyebrow">Planos</p>
        <h2>Preco depois do valor, nao antes dele</h2>
        <p>Os precos mantem o checkout atual, mas a copy agora explica ROI, rotina e quando entra success fee na recuperacao de creditos.</p>
      </div>

      <div class="pricing-grid landing-pricing-grid">
        <article class="price-card landing-price-card" data-plan-card="starter" data-reveal>
          <span class="landing-price-name">Starter</span>
          <strong>R$ 490</strong>
          <p>Para quem precisa enxergar DRE gerencial, alertas de custos e caixa com mais disciplina mensal.</p>
          <small class="landing-price-meta">Boa entrada para sair da cegueira financeira sem sobrecarregar o time.</small>
          <button class="btn btn-light" type="button" data-select-plan="starter">Comecar no Starter</button>
        </article>
        <article class="price-card featured landing-price-card landing-price-card-featured" data-plan-card="growth" data-reveal>
          <span class="landing-price-badge">Recomendado</span>
          <span class="landing-price-name">Growth</span>
          <strong>R$ 950</strong>
          <p>Para quem quer rotina tributaria e financeira mais forte, comparador de regime e margem por produto.</p>
          <small class="landing-price-meta">Melhor equilibrio entre clareza executiva, velocidade de diagnostico e acompanhamento.</small>
          <button class="btn btn-dark" type="button" data-select-plan="growth">Escolher Growth</button>
        </article>
        <article class="price-card landing-price-card" data-plan-card="enterprise" data-reveal>
          <span class="landing-price-name">Enterprise</span>
          <strong>R$ 1.850</strong>
          <p>Para operacoes com mais volume, multi-CNPJ, aprofundamento recorrente e rotinas mais complexas.</p>
          <small class="landing-price-meta">Indicado quando o time precisa escalar a visao sem perder governanca.</small>
          <button class="btn btn-light" type="button" data-select-plan="enterprise">Falar sobre Enterprise</button>
        </article>
      </div>

      <div class="landing-pricing-callout" data-reveal>
        <strong>Success Fee visivel</strong>
        <p>Recuperacao de creditos tributarios pode operar com success fee de 10% a 20% sobre o valor efetivamente recuperado, conforme escopo e complexidade.</p>
      </div>
    </section>

    <section id="faq" class="landing-section landing-faq-section">
      <div class="landing-section-heading" data-reveal>
        <p class="eyebrow landing-eyebrow">FAQ</p>
        <h2>Perguntas que bloqueiam compra e onboarding</h2>
      </div>

      <div class="landing-faq-list">
        <details class="landing-faq-item" data-reveal>
          <summary>Meus dados ficam seguros?</summary>
          <p>O FinPJ usa autenticacao, expiracao de sessao e consentimento explicito antes de usar dados do onboarding. Open Finance so acontece com autorizacao do usuario via Pluggy.</p>
        </details>
        <details class="landing-faq-item" data-reveal>
          <summary>Eu ja tenho contador. O FinPJ ainda faz sentido?</summary>
          <p>Sim. O produto nao substitui o contador; ele antecipa sinais financeiros, compara cenarios tributarios e organiza a conversa com muito mais clareza executiva.</p>
        </details>
        <details class="landing-faq-item" data-reveal>
          <summary>Posso cancelar depois?</summary>
          <p>Sim. O onboarding e o diagnostico inicial nao dependem de fidelidade para entregar valor, e a decisao de continuidade pode ser revista conforme o uso.</p>
        </details>
        <details class="landing-faq-item" data-reveal>
          <summary>Preciso conectar o banco logo de cara?</summary>
          <p>Nao. O fluxo foi ajustado para entregar um primeiro diagnostico antes do Open Finance. A conexao bancaria vira acelerador, nao bloqueio.</p>
        </details>
        <details class="landing-faq-item" data-reveal>
          <summary>O simulador gratuito ja mostra comparacao de regime?</summary>
          <p>Sim. Ele entrega uma estimativa inicial entre Simples Nacional, Lucro Presumido e Lucro Real com base no CNPJ, faturamento e margem informados.</p>
        </details>
      </div>
    </section>

    <section class="landing-section landing-final-cta" data-reveal>
      <div class="landing-final-cta-card">
        <div>
          <p class="eyebrow landing-eyebrow">Comece pelo diagnostico</p>
          <h2>Se existe imposto pago a mais, o melhor momento para descobrir e antes da proxima competencia</h2>
          <p>Rode a simulacao gratuita, veja se existe economia potencial e so depois decida se quer continuar para onboarding completo e rotina de controladoria.</p>
        </div>
        <a class="btn btn-dark btn-lg landing-cta-primary" href="#solucoes">Simular economia agora</a>
      </div>
    </section>

    <footer id="contato" class="landing-footer">
      <div class="landing-footer-grid">
        <div class="landing-footer-brand">
          <img src="/logo.svg" alt="FinPJ" width="132" height="38">
          <p>Inteligencia financeira e tributaria para PMEs brasileiras com foco em economia tributaria, caixa e visao de CFO.</p>
        </div>

        <div class="landing-footer-links">
          <a href="#solucoes">Simulador</a>
          <a href="#resultados">Resultados</a>
          <a href="#planos">Planos</a>
          <a href="#faq">FAQ</a>
          <a href="/login">Entrar</a>
          <a href="/cadastro">Criar conta</a>
        </div>
      </div>

      <div class="landing-footer-bottom">
        <span>&copy; 2026 FinPJ. Todos os direitos reservados.</span>
      </div>
    </footer>
  `;
}

function buildPublicMarkup(path) {
  if (path === '/login') return buildLoginMarkup();
  if (path === '/cadastro' || path === '/signup') return buildSignupMarkup();
  if (path === '/forgot-password') return buildForgotPasswordMarkup();
  if (path === '/reset-password') return buildResetPasswordMarkup();
  if (path === '/onboarding/verificar-email') return buildVerifyEmailMarkup();
  if (path === '/onboarding/perfil') return buildProfileMarkup();
  if (path === '/onboarding/plano') return buildPlanMarkup();
  if (path === '/onboarding/template') return buildTemplateMarkup();
  if (path === '/onboarding/checklist') return buildChecklistMarkup();
  if (path === '/onboarding/primeiro-valor') return buildFirstValueMarkup();
  if (path === '/auth/callback/google') return buildCallbackMarkup('Google');
  if (path === '/auth/callback/github') return buildCallbackMarkup('GitHub');
  if (path === '/dashboard') return buildDashboardGateMarkup();
  return buildLandingMarkup();
}

export function renderPublicExperience() {
  const path = currentPath();
  const header = document.querySelector('.topbar');
  const publicArea = document.querySelector('[data-public-area]');
  const dashboardBrand = document.querySelector('.dashboard-brand');
  const dashboardBrandImage = dashboardBrand?.querySelector('img');

  if (header) {
    header.className = isAuthPath(path) || isOnboardingPath(path)
      ? 'topbar landing-header landing-header-flow'
      : 'topbar landing-header';
    header.innerHTML = isAuthPath(path) || isOnboardingPath(path)
      ? buildFlowHeader(path)
      : LANDING_HEADER_MARKUP;
  }

  if (publicArea) {
    publicArea.innerHTML = buildPublicMarkup(path);
  }

  if (dashboardBrand) {
    dashboardBrand.setAttribute('aria-label', 'FinPJ');
  }

  if (dashboardBrandImage) {
    dashboardBrandImage.src = '/logo.svg';
    dashboardBrandImage.alt = 'FinPJ';
    dashboardBrandImage.width = 112;
    dashboardBrandImage.height = 32;
  }

  document.body?.classList.add('landing-hydrated');
}
