const { getFiscalSimulation } = require('./fiscalCache');
const taxUtils = require('../tax/utils');

const DASHBOARD_CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 250;
const dashboardCache = new Map();

function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

function round(value) {
    return Math.round(Number(value) || 0);
}

function normalizeMargin(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return numeric > 1 ? numeric / 100 : numeric;
}

function normalizeCompanyId(value) {
    return String(value || '').trim().toLowerCase();
}

function generateBankReports(seed = 'empresa') {
    const today = new Date();
    const labels = [
        'Conciliacao de extrato',
        'Revisao de lancamentos',
        'Atualizacao de saldo',
        'Alerta de fluxo de caixa',
        'Analise de recebimentos',
        'Diferenca bancaria detectada'
    ];

    return Array.from({ length: 6 }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() - index);
        const amount = Math.round((index + 3) * 3800);
        return {
            id: `${seed}-${date.toISOString().slice(0, 10)}-${index}`,
            date: date.toISOString().slice(0, 10),
            title: labels[index % labels.length],
            detail: `Atualizacao diaria para ${seed}.`,
            amount,
            status: index % 2 === 0 ? 'Concluido' : 'Atencao'
        };
    });
}

function companySnapshot(source = {}, fallback = {}) {
    const cnpj = onlyDigits(source.cnpj || fallback.cnpj);
    const email = source.email || fallback.email || '';
    const name = source.fantasia || source.nome || source.nomeEmpresa || fallback.fantasia || fallback.nome || fallback.nomeEmpresa || email || 'Empresa sem nome';
    const id = normalizeCompanyId(source.id || cnpj || email || name);

    return {
        id,
        cnpj,
        email,
        nome: source.nome || fallback.nome || '',
        fantasia: source.fantasia || source.nomeFantasia || fallback.fantasia || fallback.nomeFantasia || name,
        regime: source.regime || fallback.regime || '',
        setor: source.setor || fallback.setor || '',
        faturamento: source.faturamento ?? source.faturamentoAnual ?? fallback.faturamento ?? fallback.faturamentoAnual ?? null,
        margem: source.margem ?? source.margemEstimada ?? fallback.margem ?? fallback.margemEstimada ?? null,
        plano: source.plano || fallback.plano || null,
        statusPagamento: source.statusPagamento || fallback.statusPagamento || null,
        connectedBanks: Array.isArray(source.connectedBanks) ? source.connectedBanks : [],
        bankReports: Array.isArray(source.bankReports) ? source.bankReports : []
    };
}

function getCompanies(usuario = {}) {
    const primary = {
        ...companySnapshot(usuario),
        isPrimary: true
    };

    const companies = [primary];
    (Array.isArray(usuario.empresas) ? usuario.empresas : []).forEach((company) => {
        const snapshot = companySnapshot(company, { email: usuario.email, plano: usuario.plano });
        if (!companies.some((item) => item.id === snapshot.id)) {
            companies.push({ ...snapshot, isPrimary: false });
        }
    });

    return companies;
}

function resolveCompany(usuario, companyId) {
    const companies = getCompanies(usuario);
    const normalizedId = normalizeCompanyId(companyId);
    return companies.find((company) => company.id === normalizedId || company.cnpj === onlyDigits(companyId)) || companies[0];
}

function getTransactions(company) {
    return (company.connectedBanks || []).flatMap((bank) => (bank.transactions || []).map((transaction) => ({
        ...transaction,
        bankId: bank.bankId,
        bankName: bank.bankName || 'Banco'
    })));
}

function sumTransactions(transactions, predicate) {
    return transactions
        .filter(predicate)
        .reduce((sum, item) => sum + Math.abs(Number(item.valor ?? item.amount) || 0), 0);
}

function isTaxTransaction(item) {
    const text = String(item.categoria || item.category || item.descricao || item.description || '').toLowerCase();
    return /imposto|das|darf|tribut|fgts|inss|icms|iss|pis|cofins/.test(text);
}

function reportIsDone(report) {
    const status = String(report?.status || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    return status.includes('conclu');
}

function monthKey(date) {
    return date.toISOString().slice(0, 7);
}

function monthLabel(date) {
    return date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
}

function buildTrend(transactions, fallbackRevenue, fallbackTaxes) {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
            key: monthKey(date),
            label: monthLabel(date),
            revenue: 0,
            taxes: 0
        });
    }

    const byKey = new Map(months.map((item) => [item.key, item]));
    transactions.forEach((transaction) => {
        const rawDate = transaction.data || transaction.date || transaction.createdAt;
        const date = rawDate ? new Date(rawDate) : null;
        if (!date || Number.isNaN(date.getTime())) return;
        const target = byKey.get(monthKey(date));
        if (!target) return;
        const value = Number(transaction.valor ?? transaction.amount) || 0;
        if (value > 0 || transaction.tipo === 'entrada') target.revenue += Math.abs(value);
        if (isTaxTransaction(transaction)) target.taxes += Math.abs(value);
    });

    const hasTransactionalData = months.some((item) => item.revenue || item.taxes);
    if (!hasTransactionalData && (fallbackRevenue || fallbackTaxes)) {
        months.forEach((item) => {
            item.revenue = round(fallbackRevenue);
            item.taxes = round(fallbackTaxes);
        });
    }

    return {
        labels: months.map((item) => item.label),
        revenue: months.map((item) => round(item.revenue)),
        taxes: months.map((item) => round(item.taxes)),
        empty: !months.some((item) => item.revenue || item.taxes)
    };
}

function calculateFiscal(company, annualRevenue, margin) {
    const fiscal = {
        annualTax: 0,
        monthlyTax: 0,
        taxSavings: 0,
        bestRegime: null,
        currentRegime: taxUtils.normalizeRegime(company.regime || ''),
        cached: false
    };

    if (!annualRevenue) return fiscal;

    try {
        const { simulation, cached } = getFiscalSimulation({
            annualRevenue,
            margin,
            activity: taxUtils.normalizeActivity(company.setor || 'comercio')
        });
        const best = simulation.bestRegime || simulation.regimes?.[0] || null;
        const currentKey = taxUtils.normalizeRegime(company.regime || '');
        const current = currentKey ? simulation.regimes.find((item) => item.key === currentKey) : null;
        const taxSavings = current && current.eligible !== false
            ? Math.max(0, Number(current.annualTax || 0) - Number(best?.annualTax || 0))
            : Math.max(0, Number(simulation.savingsComparedToWorst?.annual || 0));

        return {
            annualTax: round(best?.annualTax || best?.tax),
            monthlyTax: round(best?.monthlyTax || best?.monthly),
            taxSavings: round(taxSavings),
            bestRegime: best,
            currentRegime: currentKey,
            cached
        };
    } catch (error) {
        return { ...fiscal, error: error.message };
    }
}

function buildInsights({ company, monthlyRevenue, monthlyTaxes, margin, taxSavings, pendingItems, connectedBanks }) {
    const insights = [];

    if (!company.cnpj) {
        insights.push({
            severity: 'warning',
            title: 'CNPJ ausente',
            text: 'Complete o cadastro para separar o contexto fiscal por empresa.',
            actionTab: 'profile',
            actionLabel: 'Completar perfil'
        });
    }

    if (!monthlyRevenue) {
        insights.push({
            severity: 'warning',
            title: 'Receita mensal indisponivel',
            text: 'Informe faturamento ou conecte o banco PJ para ativar a leitura mensal.',
            actionTab: connectedBanks ? 'profile' : 'openfinance',
            actionLabel: connectedBanks ? 'Editar perfil' : 'Conectar banco'
        });
    }

    if (monthlyRevenue && margin < 0.1) {
        insights.push({
            severity: 'danger',
            title: 'Margem baixa',
            text: 'A margem estimada esta abaixo de 10%. Priorize custos recorrentes antes de crescer receita.',
            actionTab: 'financial',
            actionLabel: 'Ver custos'
        });
    }

    if (taxSavings > 0) {
        insights.push({
            severity: 'success',
            title: 'Economia tributaria estimada',
            text: `Ha oportunidade anual estimada de R$ ${taxSavings.toLocaleString('pt-BR')}.`,
            actionTab: 'tax',
            actionLabel: 'Comparar regimes'
        });
    }

    if (pendingItems > 0) {
        insights.push({
            severity: 'warning',
            title: 'Pendencias financeiras',
            text: `${pendingItems} item(ns) precisam de revisao para fechar o mes com seguranca.`,
            actionTab: 'financial',
            actionLabel: 'Revisar'
        });
    }

    return insights.slice(0, 3);
}

function makeCacheKey(usuario, company) {
    const version = usuario.updatedAt || usuario.lastLogin || usuario.createdAt || '';
    return `${usuario.email || 'anon'}:${company.id}:${version}`;
}

function remember(key, value) {
    dashboardCache.set(key, {
        value,
        expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS
    });
    while (dashboardCache.size > MAX_CACHE_ENTRIES) {
        dashboardCache.delete(dashboardCache.keys().next().value);
    }
}

function buildDashboard(usuario = {}, options = {}) {
    const company = resolveCompany(usuario, options.companyId);
    const cacheKey = makeCacheKey(usuario, company);
    const cached = dashboardCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return {
            ...cached.value,
            cache: { ...cached.value.cache, hit: true }
        };
    }

    const companies = getCompanies(usuario).map((item) => ({
        id: item.id,
        cnpj: item.cnpj,
        name: item.fantasia || item.nome || item.email || 'Empresa sem nome',
        active: item.id === company.id
    }));
    const reports = company.bankReports.length ? company.bankReports : generateBankReports(company.cnpj || company.email || company.id);
    const transactions = getTransactions(company);
    const monthlyIncome = sumTransactions(transactions, (item) => Number(item.valor ?? item.amount) > 0 || item.tipo === 'entrada');
    const monthlyExpenses = sumTransactions(transactions, (item) => Number(item.valor ?? item.amount) < 0 || item.tipo === 'saida');
    const taxPaid = sumTransactions(transactions, isTaxTransaction);
    const totalMovimentado = reports.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const annualRevenue = round(company.faturamento) || (monthlyIncome ? round(monthlyIncome * 12) : round(totalMovimentado));
    const monthlyRevenue = monthlyIncome || round(annualRevenue / 12);
    const margin = normalizeMargin(company.margem);
    const profit = round(annualRevenue * margin);
    const expenses = Math.max(0, annualRevenue - profit);
    const fiscal = calculateFiscal(company, annualRevenue, margin);
    const monthlyTaxes = taxPaid || fiscal.monthlyTax || round(fiscal.annualTax / 12);
    const pendingItems = reports.filter((report) => !reportIsDone(report)).length;
    const insights = buildInsights({
        company,
        monthlyRevenue,
        monthlyTaxes,
        margin,
        taxSavings: fiscal.taxSavings,
        pendingItems,
        connectedBanks: company.connectedBanks.length
    });
    const alertCount = insights.filter((item) => item.severity === 'warning' || item.severity === 'danger').length;
    const trend = buildTrend(transactions, monthlyRevenue, monthlyTaxes);

    const safeUser = {
        email: usuario.email,
        cnpj: company.cnpj,
        createdAt: usuario.createdAt,
        lastLogin: usuario.lastLogin || usuario.createdAt,
        fantasia: company.fantasia,
        nome: company.nome,
        regime: company.regime,
        setor: company.setor,
        faturamento: company.faturamento,
        margem: company.margem,
        plano: company.plano,
        statusPagamento: company.statusPagamento,
        planAtivadoEm: usuario.planAtivadoEm || null,
        companyId: company.id
    };

    const dashboard = {
        user: safeUser,
        companies,
        currentCompanyId: company.id,
        overview: {
            period: 'month',
            generatedAt: new Date().toISOString(),
            kpis: {
                monthlyRevenue: {
                    label: 'Receita mensal',
                    value: monthlyRevenue,
                    drilldown: 'financial',
                    empty: monthlyRevenue <= 0,
                    source: monthlyIncome ? 'real' : (company.faturamento ? 'estimated' : 'fallback')
                },
                monthlyTaxes: {
                    label: 'Impostos mensais',
                    value: monthlyTaxes,
                    drilldown: 'tax',
                    empty: monthlyTaxes <= 0,
                    source: taxPaid ? 'real' : (fiscal.monthlyTax && company.faturamento ? 'estimated' : 'fallback')
                },
                profitMargin: {
                    label: 'Margem de lucro',
                    value: margin,
                    drilldown: 'statements',
                    empty: margin <= 0,
                    source: (company.margem ?? company.margemEstimada) ? 'estimated' : (monthlyIncome ? 'real' : 'fallback')
                },
                taxSavings: {
                    label: 'Economia estimada',
                    value: fiscal.taxSavings,
                    drilldown: 'diagnostics',
                    empty: fiscal.taxSavings <= 0,
                    source: fiscal.taxSavings ? 'estimated' : 'fallback'
                },
                alerts: {
                    label: 'Alertas',
                    value: alertCount,
                    drilldown: 'insights',
                    empty: alertCount <= 0
                }
            },
            trend,
            insights,
            activeCompany: companies.find((item) => item.active)
        },
        summary: {
            reportsCount: reports.length,
            totalMovimentado,
            pendencias: pendingItems
        },
        metrics: {
            annualRevenue,
            monthlyRevenue,
            monthlyIncome,
            monthlyExpenses,
            margin,
            profit,
            expenses,
            bankBalance: monthlyIncome - monthlyExpenses,
            taxPaid,
            connectedBanks: company.connectedBanks.length,
            reportsCount: reports.length,
            pendingItems,
            fiscal
        },
        reports,
        cache: {
            hit: false,
            ttlMs: DASHBOARD_CACHE_TTL_MS
        }
    };

    remember(cacheKey, dashboard);
    return dashboard;
}

function clearDashboardCache() {
    dashboardCache.clear();
}

module.exports = {
    buildDashboard,
    clearDashboardCache,
    generateBankReports,
    DASHBOARD_CACHE_TTL_MS,
    getCompanies,
    resolveCompany
};
