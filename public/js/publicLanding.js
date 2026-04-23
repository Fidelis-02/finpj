const headerMarkup = `
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
        <a href="#solucoes" data-nav-link>Solu&ccedil;&otilde;es</a>
        <a href="#recursos" data-nav-link>Recursos</a>
        <a href="#planos" data-nav-link>Planos</a>
        <a href="#sobre" data-nav-link>Sobre</a>
        <a href="#contato" data-nav-link>Contato</a>
      </nav>

      <div class="topbar-actions landing-actions">
        <a class="btn btn-ghost landing-action-secondary" href="/login" data-open-login>Entrar</a>
        <a class="btn btn-dark landing-action-primary" href="/cadastro" data-open-register>Analisar minha empresa</a>
        <button class="btn btn-ghost is-hidden" type="button" data-logout>Sair</button>
      </div>
    </div>
  </div>
`;

const publicAreaMarkup = `
  <section id="home" class="hero landing-hero">
    <div class="landing-hero-shell">
      <div class="landing-hero-copy" data-reveal>
        <p class="landing-badge">INTELIG&Ecirc;NCIA TRIBUT&Aacute;RIA E FINANCEIRA</p>
        <h1>Pague menos imposto e entenda seu financeiro em minutos</h1>
        <p class="landing-hero-text">O FinPJ analisa sua empresa e mostra o melhor regime tribut&aacute;rio e onde voc&ecirc; est&aacute; perdendo dinheiro.</p>

        <div class="hero-actions landing-hero-actions">
          <a class="btn btn-dark btn-lg landing-cta-primary" href="/cadastro" data-open-register>Analisar minha empresa gr&aacute;tis</a>
          <a class="btn btn-light btn-lg landing-cta-secondary" href="#solucoes">Ver simula&ccedil;&atilde;o</a>
        </div>

        <div class="landing-trust-notes" aria-label="Diferenciais imediatos">
          <span>Sem cart&atilde;o de cr&eacute;dito</span>
          <span>Resultado imediato</span>
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
              <span class="is-active">Vis&atilde;o Geral</span>
              <span>Simula&ccedil;&otilde;es</span>
              <span>Relat&oacute;rios</span>
              <span>Insights</span>
              <span>Documentos</span>
              <span>Configura&ccedil;&otilde;es</span>
            </nav>
          </div>

          <div class="landing-dashboard-main">
            <div class="landing-dashboard-topbar">
              <div>
                <strong>Empresa Exemplo LTDA</strong>
                <small>12.345.678/0001-90</small>
              </div>
              <span class="landing-dashboard-chip">An&aacute;lise atualizada</span>
            </div>

            <div class="landing-dashboard-kpis">
              <article class="landing-mini-metric">
                <span>Economia Anual Estimada</span>
                <strong>R$ 98.540</strong>
              </article>
              <article class="landing-mini-metric">
                <span>Melhor Regime</span>
                <strong>Lucro Presumido</strong>
              </article>
              <article class="landing-mini-metric">
                <span>Imposto Atual</span>
                <strong>R$ 256.420</strong>
              </article>
              <article class="landing-mini-metric">
                <span>Novo Imposto</span>
                <strong>R$ 157.880</strong>
              </article>
            </div>

            <div class="landing-dashboard-chart-grid">
              <article class="landing-chart-card">
                <div class="landing-chart-header">
                  <div>
                    <strong>Comparativo tribut&aacute;rio</strong>
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
                  <span><i class="legend-best"></i>Novo cen&aacute;rio</span>
                </div>
              </article>

              <article class="landing-chart-card landing-donut-card">
                <div class="landing-chart-header">
                  <div>
                    <strong>Distribui&ccedil;&atilde;o fiscal</strong>
                    <small>Receita anual</small>
                  </div>
                </div>
                <div class="landing-donut-wrap">
                  <svg class="landing-donut-chart" viewBox="0 0 180 180" role="img"
                    aria-label="Distribuicao fiscal por categoria">
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
                  <span><i class="legend-best"></i>Encargos financeiros</span>
                  <span><i class="legend-neutral"></i>Opera&ccedil;&atilde;o</span>
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
        <span>Em economia gerada</span>
      </article>
      <article class="landing-stat-card">
        <strong>98%</strong>
        <span>Precis&atilde;o das an&aacute;lises</span>
      </article>
      <article class="landing-stat-card">
        <strong>+15</strong>
        <span>Setores atendidos</span>
      </article>
    </div>
  </section>

  <section id="solucoes" class="landing-section landing-product-section">
    <div class="landing-section-heading" data-reveal>
      <p class="eyebrow landing-eyebrow">Preview do produto</p>
      <h2>Simule o cen&aacute;rio da sua empresa antes de entrar</h2>
      <p>Menos texto, mais sinal: simule regime, entenda impacto no caixa e veja oportunidades reais de economia.</p>
    </div>

    <div class="landing-product-grid">
      <article class="landing-product-card" data-reveal>
        <div class="landing-product-card-header">
          <span class="landing-chip">O que o FinPJ entrega</span>
          <h3>Clareza tribut&aacute;ria e financeira para decidir r&aacute;pido</h3>
        </div>
        <div class="landing-product-feature-list">
          <div>
            <strong>Diagn&oacute;stico em minutos</strong>
            <p>Veja o regime mais eficiente e o potencial de economia.</p>
          </div>
          <div>
            <strong>Leitura executiva</strong>
            <p>Entenda margem, press&atilde;o tribut&aacute;ria e impacto em caixa.</p>
          </div>
          <div>
            <strong>Continuidade no dashboard</strong>
            <p>Entre na plataforma e aprofunde a an&aacute;lise com hist&oacute;rico e insights.</p>
          </div>
        </div>
      </article>

      <div class="simulator-grid landing-simulator-grid" data-reveal>
        <form class="simulator-card landing-simulator-form" data-public-diagnostic-form>
          <div class="landing-card-heading">
            <span class="landing-chip">Simula&ccedil;&atilde;o p&uacute;blica</span>
            <h3>Teste a sua empresa antes de entrar</h3>
          </div>

          <label>CNPJ
            <input name="cnpj" inputmode="numeric" placeholder="00.000.000/0001-00" maxlength="18" data-cnpj-input>
          </label>

          <div class="company-info" data-company-info style="display:none;">
            <div class="info-row"><span>Raz&atilde;o Social</span><strong data-company-nome></strong></div>
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
              <option value="">N&atilde;o informado</option>
              <option value="simples">Simples Nacional</option>
              <option value="presumido">Lucro Presumido</option>
              <option value="real">Lucro Real</option>
            </select>
          </label>

          <button class="btn btn-dark full landing-simulate-button" type="submit" data-public-simulate-button
            disabled>Gerar simula&ccedil;&atilde;o agora</button>
        </form>

        <article class="simulator-card simulator-result landing-simulator-result">
          <div class="landing-card-heading">
            <span class="landing-chip">Resultado da an&aacute;lise</span>
            <h3>Melhor op&ccedil;&atilde;o estimada</h3>
          </div>
          <strong data-public-best-regime>Aguardando CNPJ</strong>
          <p data-public-diagnostic-copy>Preencha os dados para visualizar uma compara&ccedil;&atilde;o tribut&aacute;ria pr&eacute;via.</p>
          <small class="simulator-result-status" data-public-simulator-status>Digite o CNPJ para liberar a an&aacute;lise.</small>
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
      <h2>Como funciona o FinPJ</h2>
      <p>Em 3 passos simples, voc&ecirc; descobre onde economizar e como crescer com seguran&ccedil;a.</p>
    </div>

    <div class="landing-steps-grid">
      <article class="landing-step-card" data-reveal>
        <span class="landing-step-number">1</span>
        <h3>Informe os dados</h3>
        <p>Preencha os dados b&aacute;sicos da sua empresa com seguran&ccedil;a.</p>
      </article>
      <article class="landing-step-card" data-reveal>
        <span class="landing-step-number">2</span>
        <h3>An&aacute;lise inteligente</h3>
        <p>Nossa IA analisa seu cen&aacute;rio tribut&aacute;rio e financeiro.</p>
      </article>
      <article class="landing-step-card" data-reveal>
        <span class="landing-step-number">3</span>
        <h3>Receba insights</h3>
        <p>Veja oportunidades, economias e recomenda&ccedil;&otilde;es personalizadas.</p>
      </article>
    </div>
  </section>

  <section id="recursos" class="landing-section landing-benefits-section">
    <div class="landing-section-heading" data-reveal>
      <p class="eyebrow landing-eyebrow">Benef&iacute;cios</p>
      <h2>Transforme dados fiscais em decis&otilde;es estrat&eacute;gicas</h2>
    </div>

    <div class="landing-benefits-grid">
      <article class="landing-benefit-card" data-reveal>
        <h3>Descubra impostos pagos a mais</h3>
        <p>Compare regimes e encontre oportunidades reais de economia.</p>
      </article>
      <article class="landing-benefit-card" data-reveal>
        <h3>Entenda sua margem com clareza</h3>
        <p>Veja onde sua empresa ganha, perde e pode melhorar.</p>
      </article>
      <article class="landing-benefit-card" data-reveal>
        <h3>Automatize an&aacute;lises financeiras</h3>
        <p>Reduza trabalho manual e ganhe velocidade na tomada de decis&atilde;o.</p>
      </article>
      <article class="landing-benefit-card" data-reveal>
        <h3>Tenha vis&atilde;o de CFO</h3>
        <p>Acesse indicadores que normalmente s&oacute; empresas maiores possuem.</p>
      </article>
    </div>
  </section>

  <section class="landing-section landing-usecases-section">
    <div class="landing-section-heading" data-reveal>
      <p class="eyebrow landing-eyebrow">Casos de uso</p>
      <h2>Feito para empresas que precisam decidir melhor</h2>
    </div>

    <div class="landing-usecases-grid">
      <article class="landing-usecase-card" data-reveal>
        <h3>Com&eacute;rcios</h3>
        <p>Mais clareza sobre margem, caixa e press&atilde;o tribut&aacute;ria da opera&ccedil;&atilde;o.</p>
      </article>
      <article class="landing-usecase-card" data-reveal>
        <h3>Prestadores de servi&ccedil;o</h3>
        <p>Comparativos para escolher melhor o regime e proteger rentabilidade.</p>
      </article>
      <article class="landing-usecase-card" data-reveal>
        <h3>Pequenas ind&uacute;strias</h3>
        <p>Leitura mais executiva do efeito tribut&aacute;rio sobre caixa e resultado.</p>
      </article>
      <article class="landing-usecase-card" data-reveal>
        <h3>Escrit&oacute;rios cont&aacute;beis</h3>
        <p>Camada visual de simula&ccedil;&atilde;o e diagn&oacute;stico para apoiar clientes.</p>
      </article>
      <article class="landing-usecase-card" data-reveal>
        <h3>M&uacute;ltiplos CNPJs</h3>
        <p>Vis&atilde;o consolidada para grupos com mais de uma empresa.</p>
      </article>
    </div>
  </section>

  <section id="planos" class="landing-section landing-pricing-section">
    <div class="landing-section-heading" data-reveal>
      <p class="eyebrow landing-eyebrow">Planos</p>
      <h2>Planos para diferentes est&aacute;gios de maturidade financeira</h2>
      <p>Os pre&ccedil;os abaixo reutilizam a configura&ccedil;&atilde;o atual do projeto e mant&ecirc;m o checkout existente.</p>
    </div>

    <div class="pricing-grid landing-pricing-grid">
      <article class="price-card landing-price-card" data-plan-card="starter" data-reveal>
        <span class="landing-price-name">Starter</span>
        <strong>R$ 490</strong>
        <p>DRE gerencial e alertas de custos.</p>
        <button class="btn btn-light" type="button" data-select-plan="starter">Selecionar Starter</button>
      </article>
      <article class="price-card featured landing-price-card landing-price-card-featured" data-plan-card="growth" data-reveal>
        <span class="landing-price-badge">Recomendado</span>
        <span class="landing-price-name">Growth</span>
        <strong>R$ 950</strong>
        <p>Simulador fiscal e margem por produto.</p>
        <button class="btn btn-dark" type="button" data-select-plan="growth">Escolher Growth</button>
      </article>
      <article class="price-card landing-price-card" data-plan-card="enterprise" data-reveal>
        <span class="landing-price-name">Enterprise</span>
        <strong>R$ 1.850</strong>
        <p>Auditoria de cr&eacute;ditos e valuation mensal.</p>
        <button class="btn btn-light" type="button" data-select-plan="enterprise">Falar sobre Enterprise</button>
      </article>
    </div>
  </section>

  <section id="faq" class="landing-section landing-faq-section">
    <div class="landing-section-heading" data-reveal>
      <p class="eyebrow landing-eyebrow">FAQ</p>
      <h2>Perguntas frequentes antes de come&ccedil;ar</h2>
    </div>

    <div class="landing-faq-list">
      <details class="landing-faq-item" data-reveal>
        <summary>Preciso trocar de contador?</summary>
        <p>N&atilde;o. O FinPJ complementa o trabalho cont&aacute;bil, trazendo clareza financeira, simula&ccedil;&otilde;es e intelig&ecirc;ncia para tomada de decis&atilde;o.</p>
      </details>
      <details class="landing-faq-item" data-reveal>
        <summary>O FinPJ substitui uma consultoria tribut&aacute;ria?</summary>
        <p>N&atilde;o substitui uma an&aacute;lise profissional espec&iacute;fica, mas ajuda a identificar oportunidades e preparar decis&otilde;es com muito mais informa&ccedil;&atilde;o.</p>
      </details>
      <details class="landing-faq-item" data-reveal>
        <summary>Meus dados ficam seguros?</summary>
        <p>Sim. A plataforma deve seguir boas pr&aacute;ticas de seguran&ccedil;a, autentica&ccedil;&atilde;o e prote&ccedil;&atilde;o de dados.</p>
      </details>
      <details class="landing-faq-item" data-reveal>
        <summary>Funciona para qualquer regime tribut&aacute;rio?</summary>
        <p>O FinPJ compara Simples Nacional, Lucro Presumido e Lucro Real conforme as regras j&aacute; implementadas no sistema.</p>
      </details>
      <details class="landing-faq-item" data-reveal>
        <summary>Consigo usar com mais de uma empresa?</summary>
        <p>Sim. A experi&ecirc;ncia considera usu&aacute;rios com m&uacute;ltiplos CNPJs.</p>
      </details>
    </div>
  </section>

  <section class="landing-section landing-final-cta" data-reveal>
    <div class="landing-final-cta-card">
      <div>
        <p class="eyebrow landing-eyebrow">Comece agora</p>
        <h2>Pronto para entender o verdadeiro potencial financeiro da sua empresa?</h2>
        <p>Comece com uma an&aacute;lise gratuita e descubra se sua empresa est&aacute; deixando dinheiro na mesa.</p>
      </div>
      <a class="btn btn-dark btn-lg landing-cta-primary" href="/cadastro" data-open-register>Analisar minha empresa gr&aacute;tis</a>
    </div>
  </section>

  <footer id="contato" class="landing-footer">
    <div class="landing-footer-grid">
      <div id="sobre" class="landing-footer-brand">
        <img src="/logo.svg" alt="FinPJ" width="132" height="38">
        <p>Intelig&ecirc;ncia financeira e tribut&aacute;ria para PMEs brasileiras.</p>
      </div>

      <div class="landing-footer-links">
        <a href="#solucoes">Produto</a>
        <a href="#planos">Planos</a>
        <a href="#faq">Seguran&ccedil;a</a>
        <a href="#contato">Contato</a>
        <a href="#footer-legal">Termos</a>
        <a href="#footer-legal">Privacidade</a>
      </div>
    </div>

    <div id="footer-legal" class="landing-footer-bottom">
      <span>&copy; 2026 FinPJ. Todos os direitos reservados.</span>
    </div>
  </footer>
`;

export function renderPublicExperience() {
  const header = document.querySelector('.topbar');
  const publicArea = document.querySelector('[data-public-area]');
  const dashboardBrand = document.querySelector('.dashboard-brand');
  const dashboardBrandImage = dashboardBrand?.querySelector('img');

  if (header) {
    header.className = 'topbar landing-header';
    header.innerHTML = headerMarkup;
  }

  if (publicArea) {
    publicArea.innerHTML = publicAreaMarkup;
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
