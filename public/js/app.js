(() => {
const $ = s => document.querySelector(s);
const money = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FREE_FROM = 80, FEE = 8;
const CATS = { todos: 'Todos', frutas: 'Frutas', legumes: 'Legumes', verduras: 'Verduras' };
let products = [], cat = 'todos', q = '', cart = {}, step = 'cart', ok = null;
try { cart = JSON.parse(localStorage.getItem('vv-cart') || '{}'); } catch {}
const save = () => { try { localStorage.setItem('vv-cart', JSON.stringify(cart)); } catch {} };
const byId = id => products.find(p => p.id == id);

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 1800); }

function renderChips() {
  $('#chips').innerHTML = Object.entries(CATS).map(([k, v]) => `<button class="chip" data-cat="${k}" aria-pressed="${k === cat}">${v}</button>`).join('');
}
function renderGrid() {
  const list = products.filter(p => (cat === 'todos' || p.cat === cat) && p.name.toLowerCase().includes(q));
  $('#grid').innerHTML = list.length ? list.map(p => `
    <article class="card" style="--c:${p.color}" data-id="${p.id}">
      ${p.tag ? `<span class="tag">${p.tag}</span>` : ''}
      <div class="stage" aria-hidden="true">${p.emoji}</div>
      <h3>${p.name}</h3>
      <p class="price"><b>${money(p.price)}</b> / ${p.unit}</p>
      <button class="add" data-add="${p.id}" aria-label="Adicionar ${p.name} à cesta">Adicionar</button>
    </article>`).join('') : '<p class="state">Nada encontrado. Tente outro nome ou categoria.</p>';
}
const totals = () => {
  const sub = Object.entries(cart).reduce((s, [id, n]) => s + (byId(id)?.price || 0) * n, 0);
  const fee = sub && sub < FREE_FROM ? FEE : 0;
  return { sub, fee, total: sub + fee };
};
function renderCart() {
  const ids = Object.keys(cart).filter(id => byId(id)), count = ids.reduce((s, id) => s + cart[id], 0);
  $('#cartCount').textContent = count;
  const body = $('#cartBody'), foot = $('#cartFoot'), form = $('#checkout');
  form.hidden = step !== 'checkout' || !ids.length;
  if (ok) { body.innerHTML = `<div class="done"><span>🎉</span><h3>Pedido #${ok.id} recebido!</h3><p>Total ${money(ok.total)}. A equipe da loja entrará em contato para confirmar os detalhes da entrega.</p></div>`; foot.innerHTML = '<button class="btn" id="newOrder">Fazer novo pedido</button>'; return; }
  if (!ids.length) { body.innerHTML = '<div class="empty"><span>🧺</span><p>Sua cesta está vazia.<br>Escolha algo da horta para começar.</p></div>'; foot.innerHTML = ''; return; }
  body.hidden = step === 'checkout' && false;
  body.innerHTML = ids.map(id => { const p = byId(id); return `<div class="line"><span class="em">${p.emoji}</span><div><strong>${p.name}</strong><br><small>${money(p.price)} / ${p.unit}</small></div>
    <div class="qty"><button data-dec="${id}" aria-label="Diminuir">−</button><span>${cart[id]}</span><button data-inc="${id}" aria-label="Aumentar">+</button></div></div>`; }).join('');
  const t = totals(), left = FREE_FROM - t.sub;
  foot.innerHTML = `<div class="row"><span>Subtotal</span><span>${money(t.sub)}</span></div>
    <div class="row"><span>Entrega</span><span>${t.fee ? money(t.fee) : 'Grátis'}</span></div>
    <div class="row t"><span>Total</span><span>${money(t.total)}</span></div>
    ${left > 0 ? `<p class="hint">Faltam ${money(left)} para frete grátis.</p>` : '<p class="hint">Frete grátis aplicado.</p>'}
    <button class="btn" id="go">${step === 'cart' ? 'Continuar' : 'Enviar pedido'}</button>`;
}
function openCart(on) {
  $('#drawer').classList.toggle('on', on); $('#scrim').classList.toggle('on', on);
  $('#drawer').setAttribute('aria-hidden', !on); document.body.style.overflow = on ? 'hidden' : '';
  if (on) { step = 'cart'; renderCart(); $('#closeCart').focus(); }
}
function change(id, d) {
  cart[id] = Math.min(50, (cart[id] || 0) + d); if (cart[id] <= 0) delete cart[id];
  save(); renderCart();
}
async function submit() {
  const f = $('#checkout'), err = $('#formErr');
  if (!f.reportValidity()) return;
  const d = Object.fromEntries(new FormData(f));
  d.items = Object.entries(cart).map(([id, qty]) => ({ id: +id, qty }));
  const btn = $('#go'); btn.disabled = true; btn.textContent = 'Enviando…'; err.textContent = '';
  try {
    const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error);
    ok = j; cart = {}; save(); f.reset();
  } catch (e) { err.textContent = e.message || 'Não foi possível enviar. Tente de novo.'; btn.disabled = false; btn.textContent = 'Enviar pedido'; return; }
  renderCart();
}

document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.cat) { cat = t.dataset.cat; renderChips(); renderGrid(); }
  else if (t.dataset.add) {
    change(t.dataset.add, 1); const c = t.closest('.card'); c.classList.remove('added'); void c.offsetWidth; c.classList.add('added');
    const b = $('#openCart'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); toast(`${byId(t.dataset.add).name} na cesta`);
  }
  else if (t.dataset.inc) change(t.dataset.inc, 1);
  else if (t.dataset.dec) change(t.dataset.dec, -1);
  else if (t.id === 'go') { if (step === 'cart') { step = 'checkout'; renderCart(); $('#checkout').querySelector('input').focus(); } else submit(); }
  else if (t.id === 'newOrder') { ok = null; step = 'cart'; openCart(false); }
});
$('#openCart').onclick = () => openCart(true);
$('#closeCart').onclick = $('#scrim').onclick = () => openCart(false);
document.addEventListener('keydown', e => { if (e.key === 'Escape') openCart(false); });
$('#search').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); renderGrid(); });

renderChips();
fetch('/api/products').then(r => r.json()).then(p => { products = p; renderGrid(); renderCart(); })
  .catch(() => { $('#grid').innerHTML = '<p class="state">Não foi possível carregar os produtos. Atualize a página ou tente novamente mais tarde.</p>'; });
})();
