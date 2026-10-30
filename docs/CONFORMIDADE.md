# Conformidade e checklist de lançamento

LGPD, ECA Digital (Lei 15.211/2025, a "Lei Felca"), App Store e Google Play. Situação em **30/10/2026**.

> Este documento **não é parecer jurídico**. Ele resume a auditoria técnica feita no código e lista o que falta. Os textos legais estão em rascunho e precisam de revisão de advogado antes do lançamento.

## Decisões tomadas

| Tema | Decisão | Por quê |
|---|---|---|
| Idade mínima | **18+** | Evita as obrigações do ECA Digital para menores: vínculo com responsável abaixo de 16 (art. 24), supervisão parental (art. 18) e padrões protetivos (arts. 7º e 17). Também cobre bebida alcoólica no cardápio. |
| Aferição de idade | Data de nascimento no cadastro, gravada como `SELF_DECLARED_BIRTHDATE` | Os sinais nativos das lojas ainda não foram integrados (ver pendências). |
| Páginas legais | Servidas pelo próprio backend em `/legal/*` | URL pública exigida pelas duas lojas. |
| Exclusão de conta | Anonimização + exclusão dos dados pessoais | Posts e mensagens têm FKs sem cascade; a anonimização remove o vínculo pessoal. |

## Contexto legal (resumo da auditoria)
- **ECA Digital:** Lei 15.211/2025, em vigor desde 17/03/2026 (art. 41-A, incluído pela Lei 15.352/2026). Regulamentada pelo Decreto 12.880/2026. A ANPD prevê sanções administrativas a partir de novembro de 2026 e fiscalização formal em 2027. O app tem rede social e chat, o que é "acesso provável" por menores de alto risco. Com o público 18+, a obrigação principal passa a ser **aferir a idade de forma proporcional ao risco**: o guia da ANPD considera a autodeclaração insuficiente como método isolado.
- **Artigos que continuam valendo com 18+:** canal de denúncia e remoção (arts. 28–29; a denúncia não pode ser anônima), contestação pelo afetado (art. 30), tratamento de abuso sexual infantil e aliciamento (art. 27).
- **Artigos que não se aplicam:** publicidade e perfilamento (arts. 22 e 26, o app não tem anúncios), loot box (art. 20) e relatório semestral (art. 31, só acima de 1 milhão de usuários menores).
- **LGPD:** base legal por finalidade, transparência (política), direitos do titular (art. 18: acesso, portabilidade, correção, exclusão), encarregado/canal (art. 41), segurança (art. 46), transferência internacional (art. 33 e Res. CD/ANPD 19/2024).

## ✅ Pronto no código

| Requisito | Onde |
|---|---|
| Cadastro só 18+, com data de nascimento | `POST /auth/register` (`MIN_AGE = 18` em `src/legal/legal.constants.ts`); tela `Login` com seletor de data e aviso "apenas para maiores de 18 anos" |
| Contas antigas sem data de nascimento | `BirthDateGate` + `PATCH /users/me/birth-date`; menor de 18 é suspenso |
| Aceite versionado de termos e política | Checkbox no cadastro, `termsVersion`/`termsAcceptedAt`; `TermsGate` + `PATCH /users/me/accept-terms`; versão em `GET /legal/version` |
| Política, Termos, Diretrizes e Exclusão de conta em URL pública | `GET /legal/privacidade`, `/legal/termos`, `/legal/diretrizes-da-comunidade`, `/legal/exclusao-de-conta`; links no cadastro e em `Settings` |
| Exclusão de conta dentro do app | `Settings` → Excluir conta → `DELETE /auth/account` (ver o que é apagado em `FLUXOS.md` §3) |
| Página web de exclusão, exigida pelo Google | `/legal/exclusao-de-conta` (explica o fluxo no app e o pedido por e-mail) |
| Acesso e portabilidade dos dados | `Settings` → Baixar meus dados → `GET /users/me/export` (JSON com 21 seções) |
| Correção | Editar perfil (`PATCH /users/profile`) |
| Denúncia de post, usuário e mensagem de chat | `POST /reports` com `type`; botões no post, no `PlayerProfile` e no toque longo da mensagem |
| Moderação e contestação | `AdminReports` (MODERATOR/ADMIN): remover post/mensagem, banir; o denunciado é avisado com motivo e canal de contestação |
| Bloqueio de usuário | `PlayerProfile` → Bloquear; `BlockedUsers` |
| Filtro de conteúdo ofensivo | `src/common/content-filter.ts` em posts, comentários, chat, grupos, perfil e "procuro jogadores" |
| Controle de exposição | Toggles "Aparecer como presente na loja" e "Mostrar online e visto por último"; preferências de push por categoria |
| Push opcional | O app funciona com a permissão negada |
| Permissões com propósito | Câmera com texto explicativo (`app.json`, plugin `expo-camera`); microfone **desligado** (`expo-audio` com `microphonePermission: false`); galeria via seletor do sistema |
| Segurança | HTTPS no host, `helmet`, CORS por allowlist, rate limit global por sessão (`SessionThrottlerGuard`) + limites no `/auth`, tokens no `expo-secure-store`, refresh token com rotação e revogação |
| Retenção | Cron mensal: comandas e visitas > 24 meses e notificações > 6 meses são apagadas (`src/retention/`) |
| Coleta mínima | Sem localização por GPS (a presença vem do QR na loja), sem anúncios, sem SDK de analytics/terceiros de rastreamento |

## ⛔ O dono precisa fazer antes de publicar

### 1. Substituir os marcadores
Rode `grep -rn "\[\(RAZÃO\|CNPJ\|ENDEREÇO\|E-MAIL\|NOME DO\)" MIPO-App-Backend/src MIPO-App-Frontend/services`.

| Marcador | Arquivo |
|---|---|
| `[RAZÃO SOCIAL]`, `[CNPJ]`, `[ENDEREÇO]` | `MIPO-App-Backend/src/legal/legal-pages.ts` (cabeçalho do controlador) |
| `[E-MAIL DE PRIVACIDADE]` | `MIPO-App-Backend/src/legal/legal-pages.ts`, `MIPO-App-Backend/src/reports/reports.service.ts` (canal de contestação), `MIPO-App-Frontend/services/legal.ts` (`PRIVACY_EMAIL`, botão Contato) |
| `[NOME DO ENCARREGADO]` | `MIPO-App-Backend/src/legal/legal-pages.ts` |
| `[NOME DO PROVEDOR SMTP]` | `MIPO-App-Backend/src/legal/legal-pages.ts` (lista de operadores) |

Depois de trocar, **remova a faixa "RASCUNHO — revisar com advogado"** do topo das páginas e, se o texto mudar de substância, atualize `LEGAL_VERSION` para forçar o re-aceite.

### 2. Jurídico e operacional
- [ ] Revisão por advogado da Política de Privacidade, Termos de Uso e Diretrizes da Comunidade.
- [ ] Definir o **controlador** (CNPJ da loja) e o **encarregado** ou canal do titular. Agente de pequeno porte pode ter dispensa de nomear encarregado, mas precisa manter o canal; confirmar a resolução vigente.
- [ ] Conferir os contratos e DPAs dos operadores e a **transferência internacional**: Back4App (hosting), Backblaze B2 + Cloudflare (arquivos), Expo (push), provedor SMTP.
- [ ] Definir o processo de atendimento ao titular: responder pedidos em até **15 dias** (LGPD art. 19, II); pedidos de exclusão por e-mail (página de exclusão) executados pelo admin.
- [ ] Definir o processo de moderação: prazo de análise das denúncias (sugestão: até 24 h; imediato para risco à integridade), quem modera, registro das decisões, e o procedimento do art. 27 (abuso sexual infantil/aliciamento: remover, preservar os dados e comunicar às autoridades).
- [ ] Contador: confirmar se as comandas (cartão e valores, que ficam após a exclusão da conta) precisam de prazo fiscal diferente dos 24 meses.

### 3. App Store Connect (Apple)
- **Privacy Policy URL:** `<baseURL>/legal/privacidade`
- **Classificação etária:** responder ao questionário com honestidade (conteúdo gerado por usuário, mensagens livres, bebida alcoólica no cardápio, se houver). Alvo: **18+**.
- **UGC (1.2):** o app tem filtro, denúncia, bloqueio e contato publicado. Mencione isso nas notas para o revisor.
- **Sign in with Apple:** não é exigido (não há login social).
- **App Privacy ("nutrition labels"):** sugestão, *Data Linked to You*, sem rastreamento (*Tracking: No*):

| Categoria Apple | Dados | Finalidade |
|---|---|---|
| Contact Info | Nome, e-mail, telefone | App Functionality |
| User Content | Posts, comentários, fotos/vídeos, mensagens, avaliações, outros (bio, histórico de jogos) | App Functionality |
| Identifiers | User ID, Device ID (token de push) | App Functionality |
| Usage Data | Interação com o produto (check-ins na loja, pedidos, partidas) | App Functionality, Analytics (frequência interna) |
| Sensitive Info / Other | Data de nascimento | App Functionality (verificação de idade) |
| Purchases | Histórico de pedidos na loja (valores informativos) | App Functionality |

- **Privacy manifest:** os pacotes do Expo SDK trazem os próprios. Se a Apple pedir "required reason APIs", declare em `ios.privacyManifests` no `app.json`.

### 4. Google Play Console
- **Privacy policy:** `<baseURL>/legal/privacidade`
- **Exclusão de conta (Data safety → Data deletion):** in-app ✓ e URL `<baseURL>/legal/exclusao-de-conta`.
- **Público-alvo:** marcar **18+** (não entra em Families).
- **Classificação IARC:** responder com interação entre usuários, compartilhamento de conteúdo e, se houver, referência a álcool.
- **Recursos de UGC:** declarar e citar denúncia, bloqueio, filtro e moderação.
- **Permissões:** CAMERA (QR) e POST_NOTIFICATIONS (Android 13+). Confira no build final que `RECORD_AUDIO` **não** aparece no manifesto.
- **Data safety:** sugestão:

| Tipo de dado | Coletado | Compartilhado | Finalidade | Opcional |
|---|:-:|:-:|---|:-:|
| Nome, e-mail, telefone | ✓ | Não | Funcionalidade, gestão de conta | Não (e-mail ou telefone) |
| Data de nascimento (outras infos pessoais) | ✓ | Não | Verificação de idade | Não |
| Fotos e vídeos | ✓ | Não | Funcionalidade (perfil, posts, chat) | Sim |
| Mensagens no app | ✓ | Não | Funcionalidade | Sim |
| Outro conteúdo gerado (posts, avaliações, bio) | ✓ | Não | Funcionalidade | Sim |
| Atividade no app (check-ins, pedidos, partidas) | ✓ | Não | Funcionalidade, estatística interna | Sim |
| IDs do dispositivo (token de push) | ✓ | Não | Notificações | Sim |
| Histórico de compras (pedidos, sem pagamento) | ✓ | Não | Funcionalidade | Sim |

Respostas gerais: **criptografia em trânsito: Sim**; **o usuário pode pedir exclusão: Sim**. Os operadores (hosting, storage, push, e-mail) processam os dados em nome da loja e não contam como "compartilhamento" para o Google; confirme com o advogado.

### 5. Conta de teste para os revisores
- Crie uma conta de revisor maior de 18 (ex.: `revisor@<domínio>`) e informe e-mail e senha nas notas das duas lojas.
- O check-in exige o QR físico. Nas notas, inclua o deep link de check-in com um código válido (`mipo://checkin/<código>`, que o admin vê em **Painel → QR da loja**) e **não rotacione o código durante a revisão**. Como alternativa, diga que um garçom pode fazer check-in manual da conta de revisor.
- Para testar pedidos, deixe ao menos 1 item no cardápio e uma conta WAITER logada no tablet durante a revisão (ou explique que a equipe finaliza os pedidos).

## ⚠️ Pendências conhecidas e riscos

| Item | Risco | Próximo passo |
|---|---|---|
| Sinal de idade nativo das lojas não integrado (Declared Age Range na Apple, Play Age Signals no Google) | Autodeclaração isolada pode ser vista como insuficiente pela ANPD | Integrar via módulo nativo (EAS). A API da Apple pode não estar devolvendo dados no Brasil (relato de jul/2026, sem confirmação oficial). |
| Lista de palavras do filtro é curta | Variações passam | Calibrar com as denúncias reais; avaliar serviço de moderação |
| Exportação de dados vai como texto JSON pelo `Share` | Pode ficar grande demais em contas muito ativas | Gerar arquivo (`expo-file-system` + `expo-sharing`) se virar problema |
| Cadastro limitado a 5/min por IP | Em evento, todos no Wi-Fi da loja compartilham o IP; um cadastro em massa pode receber 429 | Subir o limite do `/auth/register` ou orientar cadastro pelo 4G |
| Prazos de retenção (24 meses / 6 meses) | Definidos sem validação jurídica/fiscal | Confirmar com advogado e contador e refletir na política |
| Incertezas da auditoria | Não foram verificados: orientações definitivas da ANPD (previstas para ago/2026), texto integral do Decreto 12.880, resolução atual de agente de pequeno porte | Revisar com o advogado |

## Fontes
- Lei 15.211/2025 (texto consolidado): https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/L15211.htm
- Vigência em 17/03/2026: https://www.machadomeyer.com.br/pt/inteligencia-juridica/publicacoes-ij/direito-digital/estatuto-digital-da-crianca-e-do-adolescente-lei-n-15-211-2025-entra-em-vigor-em-17-de-marco-de-2026 · https://teletime.com.br/26/02/2026/lei-que-torna-anpd-agencia-e-fixa-vigencia-do-eca-digital-e-sancionada/
- Decreto 12.880, guia e cronograma da ANPD: https://www.mayerbrown.com/pt/insights/publications/2026/04/enforcement-of-brazils-eca-digital-introduces-new-obligations-for-companies · https://www.mattosfilho.com.br/?p=119794 · https://convergenciadigital.com.br/governo/com-decreto-do-eca-digital-anpd-vai-baixar-regras-especificas-para-verificacao-etaria/ · https://www.gov.br/anpd/pt-br/assuntos/eca-digital/perguntas_respostas_eca_digital_18032026.pdf/@@download/file
- Apple App Review Guidelines (1.2, 4.8, 5.1.1, 5.1.2): https://developer.apple.com/app-store/review/guidelines/
- Apple, nova classificação etária: https://developer.apple.com/news/?id=ks775ehf
- Apple Declared Age Range no Brasil: https://canaltech.com.br/apps/apple-libera-verificacao-de-idade-para-a-app-store-no-brasil-entenda-o-que-muda/ · https://developer.apple.com/forums/thread/828152
- Google Play Age Signals: https://developer.android.com/google/play/age-signals/use-age-signals-api
- Google Play, exclusão de conta: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play, UGC: https://support.google.com/googleplay/android-developer/answer/9876937
- Expo, privacy manifest: https://docs.expo.dev/guides/apple-privacy/
- Res. CD/ANPD 19/2024 (transferência internacional): https://www.mattosfilho.com.br/?p=107482 · https://lefosse.com/?p=24187
