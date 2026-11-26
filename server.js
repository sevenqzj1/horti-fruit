'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const PUB = path.resolve(__dirname, 'public');
const DATA = path.resolve(__dirname, 'data');
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const MAX_BODY = 64 * 1024;
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
const rate = new Map();

function send(res, status, body, headers) {
  const isText = typeof body === 'string';
  res.writeHead(status, Object.assign({
    'Content-Type': isText ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY'
  }, headers || {}));
  res.end(isText ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(new Error('INVALID_JSON')); }
    });
    req.on('error', reject);
  });
}

function configured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY && ADMIN_TOKEN);
}

function tokenMatches(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function rateAllowed(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const recent = (rate.get(ip) || []).filter(ts => now - ts < 60000);
  if (recent.length >= 8) return false;
  recent.push(now);
  rate.set(ip, recent);
  if (rate.size > 2000) {
    for (const [key, values] of rate) if (!values.some(ts => now - ts < 60000)) rate.delete(key);
  }
  return true;
}

async function rpc(name, args) {
  const response = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(10000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.message || 'Database request failed');
    error.status = response.status;
    throw error;
  }
  return result;
}

async function api(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/healthz') {
    return send(res, 200, { status: 'ok', databaseConfigured: Boolean(SUPABASE_URL && SUPABASE_KEY) });
  }

  if (req.method === 'GET' && pathname === '/api/products') {
    try {
      const products = JSON.parse(fs.readFileSync(path.join(DATA, 'products.json'), 'utf8'));
      return send(res, 200, products, { 'Cache-Control': 'public, max-age=60' });
    } catch {
      return send(res, 500, { error: 'Não foi possível carregar os produtos.' });
    }
  }

  if (req.method === 'POST' && pathname === '/api/orders') {
    if (!configured()) return send(res, 503, { error: 'A loja está finalizando a configuração dos pedidos. Tente novamente em instantes.' });
    if (!rateAllowed(req)) return send(res, 429, { error: 'Muitos pedidos em pouco tempo. Aguarde um minuto e tente novamente.' });
    let data;
    try { data = await readBody(req); }
    catch (error) {
      return send(res, error.message === 'PAYLOAD_TOO_LARGE' ? 413 : 400, { error: 'Dados do pedido inválidos.' });
    }
    try {
      const result = await rpc('horti_create_order', {
        p_customer: { name: data.name, phone: data.phone, address: data.address, note: data.note || '' },
        p_items: Array.isArray(data.items) ? data.items : [],
        p_payment_method: data.pay || 'pix'
      });
      return send(res, 201, result);
    } catch (error) {
      console.error('Falha ao salvar pedido:', error.message);
      return send(res, error.status === 400 ? 400 : 502, {
        error: error.status === 400 ? 'Confira os dados e os produtos do pedido.' : 'Não foi possível registrar o pedido. Tente novamente.'
      });
    }
  }

  if (req.method === 'GET' && pathname === '/api/orders') {
    if (!configured()) return send(res, 503, { error: 'Painel administrativo não configurado.' });
    const token = req.headers['x-admin-token'];
    if (!tokenMatches(token, ADMIN_TOKEN)) return send(res, 401, { error: 'Acesso não autorizado.' });
    try {
      return send(res, 200, await rpc('horti_get_orders', { p_token: token }));
    } catch (error) {
      console.error('Falha ao consultar pedidos:', error.message);
      return send(res, 502, { error: 'Não foi possível consultar os pedidos.' });
    }
  }
  return send(res, 404, { error: 'Rota não encontrada.' });
}

const server = http.createServer(async (req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { return send(res, 400, { error: 'Endereço inválido.' }); }

  if (pathname.startsWith('/api/') || pathname === '/healthz') {
    try { return await api(req, res, pathname); }
    catch (error) {
      console.error('Erro inesperado na API:', error.message);
      if (!res.headersSent) return send(res, 500, { error: 'Erro interno do servidor.' });
      return res.destroy();
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Método não permitido.' }, { Allow: 'GET, HEAD' });
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(PUB, relative);
  if (file !== PUB && !file.startsWith(PUB + path.sep)) return send(res, 403, { error: 'Acesso negado.' });
  fs.readFile(file, (error, content) => {
    if (error) return send(res, 404, 'Página não encontrada.');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY'
    });
    if (req.method === 'HEAD') return res.end();
    res.end(content);
  });
});
server.listen(PORT, '0.0.0.0', () => console.log('Verde Vivo ativo na porta ' + PORT));
