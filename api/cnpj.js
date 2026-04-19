const FETCH_HEADERS = {
    'User-Agent': 'FinPJ/1.0 (https://github.com/finpj-app)',
    Accept: 'application/json'
};

function timeoutSignal(ms) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        return AbortSignal.timeout(ms);
    }
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), ms);
    return ctrl.signal;
}

function parseJsonBody(text) {
    const t = String(text || '').trim();
    if (!t || t.startsWith('<') || t.toLowerCase().includes('forbidden')) return null;
    try {
        return JSON.parse(t);
    } catch {
        return null;
    }
}

function mapBrasilApiCnpj(data) {
    if (!data || typeof data !== 'object') return null;
    if (data.type === 'bad_request') return null;
    if (!data.razao_social && !data.cnpj) return null;

    const situacao = String(data.descricao_situacao_cadastral || '').toUpperCase();
    const situacaoNum = String(data.codigo_situacao_cadastral || '');
    const ativo =
        situacao.includes('ATIV') ||
        situacaoNum === '02' ||
        situacaoNum === '2';

    return {
        ativo,
        nome: data.razao_social || '',
        fantasia: data.nome_fantasia || '',
        uf: data.uf,
        municipio: data.municipio,
        cnae_fiscal: data.cnae_fiscal != null ? String(data.cnae_fiscal) : '',
        cnae_descricao: data.cnae_fiscal_descricao || '',
        cnae: data.cnae_fiscal_descricao || '',
        fonte: 'brasilapi'
    };
}

function mapReceitaWsCnpj(data) {
    if (!data || typeof data !== 'object') return null;
    if (data.status === 'ERROR') return null;

    const ap = Array.isArray(data.atividade_principal) ? data.atividade_principal[0] : null;
    const codeRaw = ap && ap.code ? String(ap.code) : '';
    const cnaeDigits = codeRaw.replace(/\D/g, '').slice(0, 7);

    const situacao = String(data.situacao || '').toUpperCase();
    const ativo = situacao.includes('ATIV');

    return {
        ativo,
        nome: data.nome || '',
        fantasia: data.fantasia || '',
        uf: data.uf,
        municipio: data.municipio,
        cnae_fiscal: cnaeDigits || '',
        cnae_descricao: ap && ap.text ? ap.text : '',
        cnae: ap && ap.text ? ap.text : '',
        fonte: 'receitaws'
    };
}

async function consultarCnpjBrasilApi(cnpj) {
    const url = `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;
    const response = await fetch(url, {
        headers: FETCH_HEADERS,
        signal: timeoutSignal(14000)
    });
    const text = await response.text();
    const data = parseJsonBody(text);
    if (!data) {
        return { ok: false, status: response.status, data: null };
    }
    const mapped = mapBrasilApiCnpj(data);
    if (response.ok && mapped) {
        return { ok: true, mapped };
    }
    return { ok: false, status: response.status, data };
}

async function consultarCnpjReceitaWs(cnpj) {
    const url = `https://www.receitaws.com.br/v1/cnpj/${cnpj}`;
    const response = await fetch(url, {
        headers: FETCH_HEADERS,
        signal: timeoutSignal(20000)
    });
    const text = await response.text();
    const data = parseJsonBody(text);
    if (!data) return { ok: false };
    const mapped = mapReceitaWsCnpj(data);
    if (mapped) return { ok: true, mapped };
    const msg = data.message || 'CNPJ não encontrado';
    return { ok: false, erro: msg };
}

export default async function handler(req, res) {
    const cnpj = String(req.query.cnpj || '').replace(/\D/g, '');

    if (cnpj.length !== 14) {
        return res.status(400).json({ erro: 'CNPJ inválido' });
    }

    try {
        const b = await consultarCnpjBrasilApi(cnpj);
        if (b.ok && b.mapped) {
            return res.status(200).json(b.mapped);
        }

        const r = await consultarCnpjReceitaWs(cnpj);
        if (r.ok && r.mapped) {
            return res.status(200).json(r.mapped);
        }

        const msg =
            (b.data && b.data.message) ||
            r.erro ||
            'Não foi possível localizar este CNPJ nas bases públicas.';
        return res.status(404).json({ ativo: false, erro: msg });
    } catch (err) {
        console.error(err);
        const detalhe = err && err.name === 'AbortError' ? 'Tempo esgotado ao consultar o CNPJ.' : 'Falha de rede ao consultar o CNPJ.';
        return res.status(502).json({ erro: detalhe });
    }
}
