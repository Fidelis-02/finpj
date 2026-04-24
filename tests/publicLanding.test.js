const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');

class FakeClassList {
    constructor() {
        this.values = new Set();
    }

    add(...tokens) {
        tokens.forEach((token) => this.values.add(token));
    }

    contains(token) {
        return this.values.has(token);
    }
}

class FakeElement {
    constructor() {
        this.innerHTML = '';
        this.className = '';
        this.attributes = {};
        this.classList = new FakeClassList();
        this.childMap = new Map();
        this.src = '';
        this.alt = '';
        this.width = 0;
        this.height = 0;
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
    }

    getAttribute(name) {
        return this.attributes[name];
    }

    querySelector(selector) {
        return this.childMap.get(selector) || null;
    }
}

async function loadRenderer(context) {
    const filePath = path.resolve(__dirname, '..', 'public', 'js', 'publicLanding.js');
    const source = await fs.readFile(filePath, 'utf8');
    const transformed = source.replace(
        'export function renderPublicExperience() {',
        'function renderPublicExperience() {'
    ) + '\n\nglobalThis.__publicLandingExports = { renderPublicExperience };';

    vm.createContext(context);
    vm.runInContext(transformed, context, { filename: filePath });
    return context.__publicLandingExports.renderPublicExperience;
}

async function renderPath(pathname) {
    const header = new FakeElement();
    const publicArea = new FakeElement();
    const dashboardBrand = new FakeElement();
    const dashboardBrandImage = new FakeElement();
    dashboardBrand.childMap.set('img', dashboardBrandImage);

    const document = {
        body: new FakeElement(),
        querySelector(selector) {
            if (selector === '.topbar') return header;
            if (selector === '[data-public-area]') return publicArea;
            if (selector === '.dashboard-brand') return dashboardBrand;
            return null;
        }
    };

    const context = {
        console,
        window: { location: { pathname } },
        document
    };

    const renderPublicExperience = await loadRenderer(context);
    renderPublicExperience();

    return {
        header,
        publicArea,
        dashboardBrand,
        dashboardBrandImage,
        body: document.body
    };
}

test('landing page renders simulator-first hero, pricing and FAQ content', async () => {
    const rendered = await renderPath('/');

    assert.equal(rendered.header.className, 'topbar landing-header');
    assert.match(rendered.header.innerHTML, /Simular economia gratis/);
    assert.match(rendered.publicArea.innerHTML, /Descubra em minutos se a sua empresa esta pagando imposto acima do necessario/);
    assert.match(rendered.publicArea.innerHTML, /LGPD com consentimento explicito/);
    assert.match(rendered.publicArea.innerHTML, /R\$ 490/);
    assert.match(rendered.publicArea.innerHTML, /Success Fee visivel/);
    assert.match(rendered.publicArea.innerHTML, /Meus dados ficam seguros\?/);
    assert.equal(rendered.dashboardBrand.getAttribute('aria-label'), 'FinPJ');
    assert.equal(rendered.dashboardBrandImage.src, '/logo.svg');
    assert.equal(rendered.dashboardBrandImage.alt, 'FinPJ');
    assert.equal(rendered.dashboardBrandImage.width, 112);
    assert.equal(rendered.dashboardBrandImage.height, 32);
    assert.equal(rendered.body.classList.contains('landing-hydrated'), true);
});

test('auth and onboarding routes render dedicated flow layouts', async () => {
    const cases = [
        ['/login', /Acesse sua conta FinPJ/, /Entrar com Auth0/, /Continuar com Google/],
        ['/cadastro', /Abra sua conta FinPJ/, /Autorizo o uso dos meus dados para criar a conta/i, /Cadastro rapido com CNPJ \+ checkout/],
        ['/forgot-password', /Esqueci minha senha/, /Enviar link de recuperacao/],
        ['/reset-password', /Escolha uma nova senha/, /Salvar nova senha/],
        ['/onboarding\/verificar-email', /Ative sua conta/, /Reenviar e-mail/],
        ['/onboarding\/perfil', /Como o FinPJ deve falar com voce\?/, /Tipo de uso/],
        ['/onboarding\/plano', /Comece pelo nivel de acompanhamento/, /Freemium/],
        ['/onboarding\/template', /Qual problema voce quer enxergar primeiro\?/, /Diagnostico tributario/],
        ['/onboarding\/checklist', /Voce esta a uma etapa do primeiro diagnostico/, /Open Finance opcional/],
        ['/onboarding\/primeiro-valor', /Gere sua primeira comparacao tributaria/, /Autorizo a consulta de dados publicos do CNPJ/],
        ['/dashboard', /Sessao necessaria/, /Voltar ao simulador gratuito/]
    ];

    for (const [pathname, headingPattern, secondaryPattern, extraPattern] of cases) {
        const rendered = await renderPath(pathname);
        assert.equal(rendered.header.className, 'topbar landing-header landing-header-flow', pathname);
        assert.match(rendered.header.innerHTML, /Voltar ao simulador/);
        assert.match(rendered.publicArea.innerHTML, headingPattern, pathname);
        assert.match(rendered.publicArea.innerHTML, secondaryPattern, pathname);
        if (extraPattern) {
            assert.match(rendered.publicArea.innerHTML, extraPattern, pathname);
        }
    }
});
