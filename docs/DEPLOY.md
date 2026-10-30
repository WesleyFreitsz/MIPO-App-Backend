# Deploy do MIPO

Ordem obrigatória: **backup → SQL → backend → app novo (build nativo) → checklist pós-deploy**. O backend novo não funciona sem o SQL (login e cadastro gravam em tabelas e colunas novas), e o app antigo não funciona com o backend novo (paginação do chat e campos de cadastro mudaram).

## 1. Variáveis de ambiente do backend

| Variável | Obrigatória | Uso |
|---|:-:|---|
| `DIRECT_URL` | ✓ | URL do Postgres |
| `JWT_SECRET` | ✓ | Assinatura dos tokens (access de 15 min) |
| `DB_SSL` | | `false` desliga TLS; `verify` exige certificado válido; padrão aceita sem verificar |
| `DB_SSL_CA` | | CA do banco (com `\n` escapados) |
| `DB_SYNCHRONIZE` | | Mantenha `false` em produção. O schema é aplicado pelos arquivos de `sql/`. |
| `PORT` | | Porta HTTP (padrão 3000) |
| `CORS_ORIGINS` | | Origens permitidas, separadas por vírgula |
| `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_BUCKET`, `STORAGE_PUBLIC_URL` | ✓ | Bucket de imagens/vídeos (B2 via Cloudflare) |
| `STORAGE_FORCE_PATH_STYLE` | | `true` se o provedor exigir path-style |
| `MAIL_HOST`, `MAIL_USER`, `MAIL_PASS` | ✓ | SMTP do "esqueci a senha" |

O app aponta para a URL fixa em `MIPO-App-Frontend/services/api.ts` (`baseURL`). As páginas legais ficam em `<baseURL>/legal/...`.

## 2. Banco de dados

### 2.1 Backup
Faça um dump completo antes de qualquer coisa. `remove-salinha.sql` **apaga dados** (tabelas `rooms` e `salinha_reservations`).

```bash
pg_dump --format=custom --file=backup_antes_deploy.dump "$DIRECT_URL"
```

### 2.2 Ordem exata dos arquivos em `sql/`
Todos são idempotentes (podem rodar de novo sem erro). Rode **um arquivo por vez, sem envolver em transação**. Os que têm `ALTER TYPE ... ADD VALUE` precisam rodar **fora de BEGIN/COMMIT**.

| # | Arquivo | Observação |
|---|---|---|
| 1 | `remove-salinha.sql` | **Destrutivo.** Tem BEGIN/COMMIT próprio. |
| 2 | `conta-recompensas.sql` | **Fora de transação** (`ADD VALUE 'MODERATOR'`). Refresh tokens e resgates. |
| 3 | `eventos-notificacoes.sql` | Tem BEGIN/COMMIT próprio (o `ADD VALUE` dele já virou no-op pelo passo 2). |
| 4 | `frente-a-chat.sql` | Respostas, reações, visto por último, `clientId` (idempotência). |
| 5 | `monthly-games.sql` | Tem BEGIN/COMMIT próprio. |
| 6 | `loja-checkin.sql` | **Fora de transação** (`ADD VALUE 'WAITER'`). Visitas, códigos de check-in. |
| 7 | `loja-pedidos.sql` | Cria `order_items_kind_enum`, que o passo 8 precisa. |
| 8 | `social-loja-help-enum.sql` | **Fora de transação** (`ADD VALUE 'HELP'`). |
| 9 | `social-loja-historico.sql` | Histórico de jogos. |
| 10 | `social-loja-avaliacoes.sql` | Avaliações. |
| 11 | `social-loja-procuro.sql` | Procuro jogadores. |
| 12 | `conformidade.sql` | Data de nascimento, aceite de termos, `showLastSeen`, tipo de denúncia, `age` passa a aceitar nulo. **Obrigatório antes do backend novo** (sem ele o cadastro quebra). |

Com `psql`, cada arquivo roda em autocommit por padrão:

```bash
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f sql/remove-salinha.sql
```

> Esse conjunto foi aplicado duas vezes seguidas num Postgres 17 montado a partir do dump de produção, sem erro. O diff contra as entidades do TypeORM ficou só em nomes de constraints. `DB_SYNCHRONIZE=true` renomearia constraints, o que não faz mal, mas não é necessário.

## 3. Backend
1. Configure as variáveis acima no host.
2. Faça o deploy da branch com o código novo (`npm ci && npm run build`, `node dist/main`).
3. Verifique `GET /` (200), `GET /legal/version` e `GET /legal/privacidade`.

## 4. App (build nativo novo)
O app novo usa módulos nativos que o Expo Go ou um update OTA não entregam: `expo-camera` (QR), `expo-audio` (bip, **microfone desligado**), `expo-keep-awake` (tablet), `expo-secure-store` (tokens) e `expo-notifications` (canal `orders` com som). Também mudou o `scheme: "mipo"` (deep links).

```bash
eas build --platform all
```

Publique nas lojas e, se possível, force a atualização: versões antigas do app não conversam com a API nova (chat e cadastro).

## 5. Keep-alive
O workflow `MIPO-App-Backend/.github/workflows/keep-alive.yml` pinga o backend a cada 10 min, das 7h à 0h (horário de Brasília), para o host não dormir. Os crons de lembrete, agendamento e fechamento dependem disso.

No GitHub do repositório: **Settings → Secrets and variables → Actions → Variables** → criar `BACKEND_URL` = URL base do backend (sem `/` no fim).

## 6. Checklist pós-deploy
- [ ] **Painel → Usuários:** promover os garçons a `Garçom` (WAITER) e quem modera a `Moderador`.
- [ ] **Painel → QR da loja:** rotacionar o código, imprimir o QR e colar no balcão e nas mesas. Testar lendo com a câmera do celular (deve abrir o app e fazer check-in).
- [ ] **Painel → Cardápio:** cadastrar itens com foto e preço, marcar os destaques do dia.
- [ ] **Painel → Jogos do mês:** configurar até 3 jogos do mês atual com prêmios.
- [ ] **Tablet da cozinha/balcão:** logar com uma conta WAITER, abrir **Pedidos**, deixar o volume alto e confirmar o bip com um pedido de teste e com um "chamar monitor".
- [ ] **Push:** fazer um pedido num celular, finalizar no tablet e conferir o push "Seu pedido está pronto!". No Android, verificar o canal "orders" com som.
- [ ] **Fechar comanda** de teste e ver o pedido de avaliação no celular do cliente.
- [ ] Substituir os marcadores `[...]` das páginas legais (ver `CONFORMIDADE.md`) **antes** de publicar nas lojas.
- [ ] Criar a variável `BACKEND_URL` do keep-alive e rodar o workflow manualmente uma vez.
