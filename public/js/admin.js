(() => {
  const form = document.querySelector('#login');
  const tokenInput = document.querySelector('#token');
  const status = document.querySelector('#status');
  const list = document.querySelector('#orders');
  const money = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function render(orders) {
    if (!Array.isArray(orders) || !orders.length) {
      list.innerHTML = '<p class="empty">Nenhum pedido registrado até o momento.</p>';
      return;
    }
    list.innerHTML = orders.map(order => {
      const customer = order.customer || {};
      const items = Array.isArray(order.items) ? order.items : [];
      const date = new Date(order.created_at || order.createdAt).toLocaleString('pt-BR');
      return `<article class="order"><div class="order-top"><h2>Pedido #${escapeHtml(order.id)} · ${escapeHtml(order.status)}</h2><time>${escapeHtml(date)}</time></div><p><strong>${escapeHtml(customer.name)}</strong> · ${escapeHtml(customer.phone)}</p><p>${escapeHtml(customer.address)}</p>${customer.note ? `<p>Observação: ${escapeHtml(customer.note)}</p>` : ''}<ul>${items.map(item => `<li>${escapeHtml(item.qty)} × ${escapeHtml(item.name)} — ${money(item.price * item.qty)}</li>`).join('')}</ul><p>Pagamento: ${escapeHtml(order.payment_method || 'Não informado')}</p><p class="total">Total: ${money(order.total)}</p></article>`;
    }).join('');
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const token = tokenInput.value.trim();
    if (!token) return;
    status.textContent = 'Carregando pedidos…';
    list.innerHTML = '';
    try {
      const response = await fetch('/api/orders', { headers: { 'x-admin-token': token } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível acessar os pedidos.');
      sessionStorage.setItem('vv-admin-token', token);
      render(data);
      status.textContent = data.length + ' pedido(s) encontrado(s). Atualize a página para consultar novamente.';
    } catch (error) {
      status.textContent = error.message;
    }
  });

  const saved = sessionStorage.getItem('vv-admin-token');
  if (saved) { tokenInput.value = saved; form.requestSubmit(); }
})();