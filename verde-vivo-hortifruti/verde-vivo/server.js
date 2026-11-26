// Verde Vivo — servidor sem dependências (Node 18+). Rode: node server.js
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'troque-esta-senha';
const PUB = path.join(__dirname, 'public'), DATA = path.join(__dirname, 'data');
const FREE_FROM = 80, FEE = 8;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const readJSON = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const readBody = req => new Promise((ok, no) => {
  let b = '';
  req.on('data', c => { b += c; if (b.length > 1e5) { no(new Error('grande')); req.destroy(); } });
  req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch (e) { no(e); } });
});
const clean = (v, n) => String(v || '').trim().slice(0, n);

async function api(req, res, url) {
  if (req.method === 'GET' && url === '/api/products') return send(res, 200, readJSON('products.json'));
  if (req.method === 'POST' && url === '/api/orders') {
    let d; try { d = await readBody(req); } catch { return send(res, 400, { error: 'Pedido inválido.' }); }
    const prods = readJSON('products.json'), items = [];
    for (const i of Array.isArray(d.items) ? d.items : []) {
      const p = prods.find(x => x.id === i.id), q = Math.floor(Number(i.qty));
      if (p && q > 0 && q <= 50) items.push({ id: p.id, name: p.name, unit: p.unit, price: p.price, qty: q });
    }
    const c = { name: clean(d.name, 80), phone: clean(d.phone, 20), address: clean(d.address, 200), note: clean(d.note, 200), pay: ['pix', 'cartao', 'dinheiro'].includes(d.pay) ? d.pay : 'pix' };
    if (!items.length) return send(res, 400, { error: 'Sua cesta está vazia.' });
    if (!c.name || c.phone.replace(/\D/g, '').length < 10 || c.address.length < 8) return send(res, 400, { error: 'Preencha nome, telefone e endereço.' });
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const fee = subtotal >= FREE_FROM ? 0 : FEE;
    const orders = readJSON('orders.json');
    const order = { id: orders.length + 1001, createdAt: new Date().toISOString(), status: 'novo', customer: c, items, subtotal: +subtotal.toFixed(2), fee, total: +(subtotal + fee).toFixed(2) };
    orders.push(order);
    fs.writeFileSync(path.join(DATA, 'orders.json'), JSON.stringify(orders, null, 2));
    return send(res, 201, { id: order.id, total: order.total });
  }
  if (req.method === 'GET' && url === '/api/orders') {
    if (req.headers['x-admin-token'] !== ADMIN_TOKEN) return send(res, 401, { error: 'Não autorizado.' });
    return send(res, 200, readJSON('orders.json'));
  }
  send(res, 404, { error: 'Rota não encontrada.' });
}

http.createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  try {
    if (url.startsWith('/api/')) return await api(req, res, url);
    const file = path.normalize(path.join(PUB, url === '/' ? 'index.html' : url));
    if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Página não encontrada'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(buf);
    });
  } catch { send(res, 500, { error: 'Erro no servidor.' }); }
}).listen(PORT, () => console.log(`Verde Vivo no ar: http://localhost:${PORT}`));
