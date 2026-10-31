# Estado atual do sistema - FinPJ

**Atualizado em:** 2026-10-31
**Branch de referência:** `evolution`

## Resumo

O FinPJ é uma plataforma de gestão financeira e tributária para PMEs brasileiras.
A aplicação combina um frontend Next.js/React com uma API Express e persistência
em MongoDB Atlas.

## Arquitetura

### Frontend principal

- Next.js 14 com App Router.
- React 18 e TypeScript.
- Tailwind CSS, Framer Motion, Recharts e componentes próprios.
- Landing page e áreas autenticadas em [`src/app`](../src/app).
- Dashboard, motor fiscal, DRE, custos, Open Finance, documentos e insights.

### Backend

- Node.js 18+ e Express.
- Rotas centralizadas em [`src/routes/index.js`](../src/routes/index.js).
- Controllers e serviços separados por domínio.
- MongoDB Atlas com índices para usuários, diagnósticos, análises, sessões e onboarding.
- JWT, bcrypt, sessões revogáveis, rate limiting, Helmet, CORS e validação de entrada.

### Integrações

- Pluggy para Open Finance.
- Stripe para pagamentos e webhooks.
- R2/S3 para armazenamento de documentos.
- OCR com Tesseract.js.
- Processamento de PDF e Excel.
- IA/Groq para análise e chat.
- OAuth Google/Auth0.
- Radar público de notícias em [`src/services/newsService.js`](../src/services/newsService.js),
  com NewsAPI obrigatória, cache, deduplicação,
  relevância por domínio e oportunidades.

### Deploy

- Vercel configurado em [`vercel.json`](../vercel.json).
- `server.js` atende a API serverless.
- Next.js atende as páginas.
- A pasta [`public`](../public) contém a superfície Vanilla JS legada, mantida
  por compatibilidade local e por fluxos existentes; o frontend principal é o Next.js.

## Fluxos principais

1. Cadastro/login → JWT e sessão persistida no MongoDB.
2. Onboarding → perfil, empresa, plano e primeiro diagnóstico.
3. Dashboard → KPIs, tendências, alertas e economia tributária estimada.
4. Open Finance → token Pluggy, conexão bancária, sincronização e categorização.
5. Documentos → upload, OCR/extração, validação do tipo e da qualidade mínima,
   análise, histórico por empresa e chat. Arquivos incompatíveis ou sem pelo menos
   dois termos contábeis reconhecidos são rejeitados explicitamente; a resposta
   inclui os termos encontrados e a quantidade de caracteres extraídos. A tela de
   DRE/Balanço consome `GET /api/analises` e exibe apenas indicadores realmente
   presentes nas análises salvas.
6. Fiscal → simulação de regimes, DAS, calendário e diagnósticos.
7. Pagamentos → checkout, success fee e webhook Stripe idempotente.
8. Notícias → consulta NewsAPI no backend, filtro das últimas 48 horas, classificação por
   tema e recomendação de ação na homepage.
9. Motor fiscal → simulações carregam a versão, a origem, a data de revisão configurada
   e um catálogo por grupo de regra, com fonte, vigência quando conhecida e status
   (`embedded`, `assumption` ou `projection`). Não há atualização legislativa
   automática sem integração adicional.
10. Piloto → eventos operacionais de documentos são registrados sem e-mail, nome de
    arquivo ou conteúdo: início, conclusão, rejeição e falha. `GET /api/pilot/metrics`
    retorna somente as métricas agregadas do usuário autenticado, opcionalmente
    filtradas pela empresa ativa.

## Qualidade verificada

Comandos disponíveis em [`package.json`](../package.json):

- `npm test`: 14 testes backend aprovados na última validação.
- `npm run test:frontend`: 9 testes Jest aprovados na última validação.
- `npm run build`: build Next.js aprovado, incluindo type-check.

O build emite apenas um aviso não bloqueante sobre a versão do banco de dados do
Browserslist.

## Estado do versionamento

- `.next/` é artefato gerado e deve permanecer ignorado pelo Git.
- Logs, `.env`, dados locais, backups e arquivos de teste manual também não devem
  ser versionados.
- O frontend legado em `public/` não deve ser removido sem validar os fluxos locais
  e os consumidores que ainda dependem dele.

## Melhorias priorizadas

### Concluídas nesta atualização

- Alinhamento da documentação com a arquitetura real.
- Remoção de artefatos `.next` do índice do Git, mantendo-os localmente ignorados.
- Correção dos consumidores Next.js para usar `/api/dashboard`, `/api/companies` e
  `/api/openfinance/summary`.
- Integração da tela Next.js de Open Finance com o token e widget Pluggy existentes.
- Estados de erro explícitos no dashboard, custos, empresas e Open Finance.

### Próximas

1. Expandir testes de contratos da API e dos fluxos de Open Finance.
2. Substituir dados mock por estados explícitos de “sem dados” ou “aguardando sincronização”.
3. Adicionar observabilidade, métricas de sincronização e trilha de auditoria.
4. Consolidar progressivamente a superfície Vanilla JS em Next.js.
5. Melhorar conciliação, categorização e confirmação de transações.
6. Validar acessibilidade, responsividade e permissões por empresa.

## Radar de notícias

`GET /api/news` é público para atender a homepage. O backend consulta somente a
NewsAPI usando o header `X-Api-Key`; `NEWSAPI_KEY` deve estar configurada.
O serviço aplica timeout, cache de 15 minutos,
deduplicação e descarta itens fora da janela de 48 horas. As oportunidades são heurísticas determinísticas por tema; não são
aconselhamento fiscal ou financeiro e devem ser confirmadas antes de qualquer decisão.

Em caso de falha da NewsAPI, o endpoint retorna erro e a homepage exibe o estado
de indisponibilidade, sem substituir notícias por outra fonte.

## Referência de produto

A auditoria foi orientada por padrões públicos comuns em Conta Azul, QuickBooks e
Xero: onboarding guiado, conexão bancária com estado de sincronização, conciliação
assistida, visão de fluxo de caixa, alertas acionáveis, permissões e rastreabilidade.
Nenhum código proprietário ou mecanismo interno desses produtos foi utilizado.
