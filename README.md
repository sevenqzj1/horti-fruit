# Verde Vivo Hortifruti

Loja virtual responsiva de frutas, legumes e verduras, com catálogo, busca, categorias, carrinho, cálculo de entrega, checkout e consulta administrativa de pedidos.

## Tecnologias
- HTML, CSS e JavaScript no frontend.
- Node.js 20+ no servidor HTTP.
- Supabase PostgreSQL para persistência dos pedidos e validação dos preços.
- Render Web Service para hospedagem.

## Executar localmente
```bash
npm start
```

Configure as variáveis de ambiente antes de testar o checkout:
```env
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_PUBLISHABLE_KEY=sua_chave_publicavel
ADMIN_TOKEN=seu_token_administrativo
```

A loja abre em `http://localhost:3000`. O endpoint administrativo de pedidos é `GET /api/orders`, protegido pelo cabeçalho `x-admin-token`.

## Rotas
- `GET /healthz`: verificação de saúde.
- `GET /api/products`: catálogo público.
- `POST /api/orders`: valida e registra um pedido no Supabase.
- `GET /api/orders`: lista os últimos pedidos com token administrativo.

Os preços são conferidos novamente no PostgreSQL; o navegador não define os valores finais. As tabelas de pedidos e catálogo têm RLS habilitado e não concedem acesso direto às roles públicas. As operações públicas passam por funções SQL controladas.

## Render
Ligar o repositório `sevenqzj1/horti-fruit`, branch `main), raiz do repositório, runtime Node, build command `npm install` e start command `npm start`. Configurar `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `ADMIN_TOKEN` como variáveis privadas do serviço. Não publicar chaves secretas no frontend ou no Git.

## Conteúdo comercial
Endereço, telefone, WhatsApp, horários e área de entrega devem ser preenchidos com os dados reais da loja antes da divulgação pública.
