# Verde Vivo — Hortifruti

Site completo de hortifruti: loja responsiva, cesta com checkout e backend de pedidos.
**Sem dependências** — só precisa do Node.js 18 ou mais novo.

## Como rodar
```
node server.js
```
Abra http://localhost:3000

## Estrutura
- `server.js` — servidor (arquivos estáticos + API)
- `public/` — frontend (HTML, CSS, JS)
- `data/products.json` — catálogo (edite preços, nomes e emojis)
- `data/orders.json` — pedidos recebidos

## API
- `GET /api/products` — lista produtos
- `POST /api/orders` — cria pedido (preços e total são recalculados no servidor)
- `GET /api/orders` — lista pedidos; exige o header `x-admin-token`

## Configuração
- `PORT` — porta (padrão 3000)
- `ADMIN_TOKEN` — senha para ver pedidos. **Troque antes de publicar.**
  Ex.: `ADMIN_TOKEN=minha-senha node server.js`

## Personalizar
Cores e espaçamentos ficam nas variáveis no topo de `public/css/style.css`.
Frete grátis e taxa: `FREE_FROM` e `FEE` em `server.js` e `public/js/app.js`.
