import { LEGAL_VERSION, MIN_AGE } from './legal.constants';

const CONTROLLER =
  '[RAZÃO SOCIAL], inscrita no CNPJ sob o nº [CNPJ], com sede em [ENDEREÇO]';
const PRIVACY_EMAIL = '[E-MAIL DE PRIVACIDADE]';
const DPO_NAME = '[NOME DO ENCARREGADO]';

export type LegalPage =
  | 'privacidade'
  | 'termos'
  | 'exclusao-de-conta'
  | 'diretrizes-da-comunidade';

function layout(title: string, body: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Mipo</title>
<style>
  :root { color-scheme: light dark; --fg: #1d1b16; --muted: #5d5a52; --bg: #fffdf5; --accent: #f6e22d; --line: #e6e1cf; }
  @media (prefers-color-scheme: dark) { :root { --fg: #f3f0e6; --muted: #b9b4a6; --bg: #17150f; --line: #34312a; } }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; }
  h1 { font-size: 1.8rem; line-height: 1.2; margin: 0 0 4px; }
  h2 { font-size: 1.2rem; margin: 32px 0 8px; padding-top: 8px; border-top: 1px solid var(--line); }
  .meta { color: var(--muted); font-size: .9rem; margin: 0 0 16px; }
  .draft { background: var(--accent); color: #1d1b16; padding: 10px 12px; border-radius: 10px; font-weight: 700; margin-bottom: 20px; }
  ul { padding-left: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: .95rem; }
  th, td { text-align: left; vertical-align: top; padding: 8px; border-bottom: 1px solid var(--line); }
  a { color: inherit; }
</style>
</head>
<body><main>
<p class="draft">RASCUNHO — revisar com advogado antes de publicar.</p>
<h1>${title}</h1>
<p class="meta">Versão ${LEGAL_VERSION}</p>
${body}
<p class="meta"><a href="./privacidade">Privacidade</a> · <a href="./termos">Termos de uso</a> · <a href="./diretrizes-da-comunidade">Diretrizes da comunidade</a> · <a href="./exclusao-de-conta">Excluir conta</a></p>
</main></body>
</html>`;
}

const privacy = `
<p>Esta política explica como o aplicativo Mipo trata dados pessoais, nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).</p>

<h2>1. Quem é o controlador</h2>
<p>O controlador dos dados é ${CONTROLLER}. Encarregado pelo tratamento de dados (DPO): ${DPO_NAME}, contato: ${PRIVACY_EMAIL}.</p>

<h2>2. Público</h2>
<p>O aplicativo é destinado exclusivamente a maiores de ${MIN_AGE} anos. Pedimos a data de nascimento no cadastro e não aceitamos contas de pessoas com idade inferior. Se identificarmos uma conta de menor de idade, ela será encerrada.</p>

<h2>3. Dados que tratamos</h2>
<table>
<tr><th>Categoria</th><th>Dados</th></tr>
<tr><td>Cadastro</td><td>nome, e-mail ou telefone, senha (armazenada apenas como hash), data de nascimento, versão dos termos aceitos e data do aceite.</td></tr>
<tr><td>Perfil</td><td>apelido, cidade, bio, foto de perfil, preferências de privacidade e de notificação.</td></tr>
<tr><td>Atividade social</td><td>publicações, comentários, curtidas, menções, amizades, bloqueios, mensagens de chat (texto e imagens), reações e chamados de "procuro jogadores".</td></tr>
<tr><td>Presença na loja</td><td>data e hora de entrada e saída (check-in por QR code ou feito pela equipe). Outros usuários veem que você está na loja apenas se a opção "Aparecer como presente na loja" estiver ligada.</td></tr>
<tr><td>Pedidos na loja</td><td>nome informado na comanda, número do cartão de consumo entregue pela loja, itens pedidos, mesa, observações, status e valores estimados.</td></tr>
<tr><td>Jogos e gamificação</td><td>histórico de partidas, jogos favoritos e "quero jogar", avaliações de jogos, pontuações dos jogos do mês, conquistas, moedas e resgates de recompensas.</td></tr>
<tr><td>Avaliações</td><td>notas e comentários sobre visitas e pedidos.</td></tr>
<tr><td>Denúncias</td><td>conteúdo denunciado, motivo e decisão da moderação.</td></tr>
<tr><td>Dados técnicos</td><td>token de notificação push do aparelho, registros de acesso (IP, data e hora) exigidos pelo Marco Civil da Internet, e status de conexão no chat ("online"/"visto por último").</td></tr>
</table>
<p>Não coletamos dados de localização por GPS, contatos da agenda, nem dados de pagamento. O pagamento da comanda é feito diretamente no caixa da loja.</p>

<h2>4. Para que usamos e com qual base legal</h2>
<table>
<tr><th>Finalidade</th><th>Base legal (LGPD, art. 7º)</th></tr>
<tr><td>Criar e manter sua conta, autenticar o acesso, exibir seu perfil e as funções sociais.</td><td>Execução de contrato (inciso V).</td></tr>
<tr><td>Check-in, comandas e pedidos na loja, histórico de jogos, jogos do mês, conquistas e recompensas.</td><td>Execução de contrato (inciso V).</td></tr>
<tr><td>Verificar a idade mínima.</td><td>Cumprimento de obrigação legal (inciso II) e execução de contrato.</td></tr>
<tr><td>Moderação de conteúdo, prevenção a fraudes, segurança da comunidade e atendimento a denúncias.</td><td>Legítimo interesse (inciso IX) e cumprimento de obrigação legal.</td></tr>
<tr><td>Recomendações de jogos e estatísticas de frequência para a loja.</td><td>Legítimo interesse (inciso IX), sem uso para publicidade.</td></tr>
<tr><td>Notificações push.</td><td>Consentimento (inciso I), dado pela permissão do sistema operacional e revogável a qualquer momento nas configurações do app ou do aparelho.</td></tr>
<tr><td>Guarda de registros de acesso.</td><td>Obrigação legal (Lei 12.965/2014, art. 15).</td></tr>
</table>
<p>Não vendemos dados pessoais, não exibimos publicidade e não criamos perfis para fins publicitários.</p>

<h2>5. Com quem compartilhamos</h2>
<p>Compartilhamos dados apenas com operadores que prestam serviços para o funcionamento do app, sob contrato:</p>
<ul>
<li><strong>Back4App</strong> — hospedagem do servidor e do banco de dados.</li>
<li><strong>Backblaze (B2) e Cloudflare</strong> — armazenamento e entrega de imagens e vídeos enviados.</li>
<li><strong>Expo (650 Industries)</strong> — envio de notificações push, junto aos serviços da Apple e do Google.</li>
<li><strong>Provedor de e-mail [NOME DO PROVEDOR SMTP]</strong> — envio do código de recuperação de senha.</li>
</ul>
<p>Também podemos compartilhar dados com autoridades públicas quando exigido por lei ou ordem judicial, inclusive para comunicar indícios de crimes contra crianças e adolescentes.</p>

<h2>6. Transferência internacional</h2>
<p>Alguns operadores mantêm servidores fora do Brasil, principalmente nos Estados Unidos. Essas transferências ocorrem com base nas cláusulas-padrão contratuais aprovadas pela ANPD (Resolução CD/ANPD nº 19/2024) ou em outra hipótese do art. 33 da LGPD, e os operadores adotam medidas de segurança compatíveis.</p>

<h2>7. Por quanto tempo guardamos</h2>
<ul>
<li>Dados da conta, perfil e conteúdo: enquanto a conta estiver ativa.</li>
<li>Visitas à loja e comandas fechadas: até 24 meses.</li>
<li>Notificações: até 6 meses.</li>
<li>Registros de acesso: 6 meses, conforme o Marco Civil da Internet.</li>
<li>Após a exclusão da conta: os dados são apagados ou anonimizados, salvo o que precisarmos manter para cumprir obrigação legal (por exemplo, a comanda sem o seu nome, pelo prazo de retenção acima).</li>
</ul>

<h2>8. Seus direitos</h2>
<p>Você pode, a qualquer momento (LGPD, art. 18): confirmar a existência de tratamento; acessar seus dados; corrigir dados incompletos ou desatualizados; pedir anonimização, bloqueio ou eliminação de dados desnecessários; pedir a portabilidade; obter informações sobre compartilhamento; revogar o consentimento; e se opor a tratamentos feitos com base no legítimo interesse.</p>
<ul>
<li><strong>No app:</strong> Perfil → Configurações → "Baixar meus dados" (exportação) e "Excluir conta".</li>
<li><strong>Por e-mail:</strong> ${PRIVACY_EMAIL}. Respondemos em até 15 dias.</li>
<li>Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</li>
</ul>

<h2>9. Segurança</h2>
<p>Usamos conexão criptografada (HTTPS), senhas com hash, tokens de acesso de curta duração, limitação de tentativas de login e controle de acesso por perfil. Nenhum sistema é totalmente imune a falhas; em caso de incidente de segurança relevante, comunicaremos a ANPD e os titulares afetados.</p>

<h2>10. Moderação</h2>
<p>Conteúdos e usuários podem ser denunciados no app. A equipe analisa as denúncias e pode remover conteúdo ou suspender contas que violem os <a href="./termos">Termos de uso</a> e as <a href="./diretrizes-da-comunidade">Diretrizes da comunidade</a>. Quem for afetado é notificado com o motivo e pode contestar pelo e-mail ${PRIVACY_EMAIL}.</p>

<h2>11. Alterações</h2>
<p>Quando esta política mudar de forma relevante, o app pedirá que você leia e aceite a nova versão.</p>
`;

const terms = `
<p>Ao criar uma conta no aplicativo Mipo você concorda com estes termos. O serviço é oferecido por ${CONTROLLER}.</p>

<h2>1. Quem pode usar</h2>
<p>Apenas pessoas com ${MIN_AGE} anos ou mais. Ao se cadastrar, você declara que a data de nascimento informada é verdadeira. Contas criadas com dados falsos podem ser encerradas.</p>

<h2>2. Sua conta</h2>
<ul>
<li>Você é responsável por manter sua senha em segredo e por tudo o que for feito com sua conta.</li>
<li>Uma conta é pessoal e intransferível.</li>
<li>Você pode excluir sua conta a qualquer momento pelo app.</li>
</ul>

<h2>3. Conteúdo que você publica</h2>
<p>Você continua dono do conteúdo que publica (posts, comentários, mensagens, fotos) e nos concede uma licença gratuita e não exclusiva para armazená-lo e exibi-lo dentro do app enquanto ele estiver publicado. Você declara ter os direitos sobre o conteúdo e se compromete a seguir as <a href="./diretrizes-da-comunidade">Diretrizes da comunidade</a>.</p>

<h2>4. Moderação</h2>
<p>Podemos remover conteúdo e suspender ou encerrar contas que violem estes termos ou a lei, com ou sem denúncia prévia. Você será notificado da decisão e do motivo e poderá contestá-la pelo e-mail ${PRIVACY_EMAIL}.</p>

<h2>5. Funções da loja</h2>
<ul>
<li>O check-in indica que você está na loja física e pode ser visto por outros usuários, se você permitir.</li>
<li>Pedidos feitos pelo app são registrados na comanda vinculada ao número do cartão entregue pela loja. Os preços exibidos são informativos; o valor cobrado é o do caixa da loja.</li>
<li>Moedas, conquistas e recompensas são virtuais, não têm valor monetário, não podem ser trocadas por dinheiro e podem ter regras alteradas pela loja.</li>
</ul>

<h2>6. Disponibilidade</h2>
<p>O app é oferecido "no estado em que se encontra". Podemos alterar, suspender ou encerrar funções, com aviso prévio sempre que possível.</p>

<h2>7. Privacidade</h2>
<p>O tratamento de dados pessoais segue a <a href="./privacidade">Política de privacidade</a>.</p>

<h2>8. Lei aplicável</h2>
<p>Estes termos seguem as leis brasileiras. Fica eleito o foro do domicílio do consumidor.</p>
`;

const community = `
<p>A Mipo é um lugar para encontrar gente e jogar. Para manter a comunidade boa para todos:</p>
<h2>Não é permitido</h2>
<ul>
<li>Assédio, ameaças, intimidação ou perseguição, inclusive por mensagens privadas.</li>
<li>Discurso de ódio ou discriminação por raça, cor, etnia, religião, origem, gênero, orientação sexual, deficiência ou qualquer outra característica.</li>
<li>Conteúdo sexual explícito, nudez, e qualquer conteúdo que sexualize crianças ou adolescentes — esse caso é comunicado às autoridades.</li>
<li>Violência gráfica, incentivo a automutilação, suicídio ou uso de drogas.</li>
<li>Spam, golpes, venda de produtos ou divulgação não autorizada.</li>
<li>Divulgar dados pessoais de outras pessoas sem autorização.</li>
<li>Fingir ser outra pessoa ou a equipe da loja.</li>
</ul>
<h2>Como denunciar</h2>
<p>Você pode denunciar publicações, mensagens de chat e perfis pelo próprio app, e bloquear qualquer usuário. A equipe analisa as denúncias e informa o resultado a quem denunciou.</p>
<h2>Consequências</h2>
<p>Dependendo da gravidade: remoção do conteúdo, aviso, suspensão ou banimento da conta. A pessoa afetada é notificada e pode contestar pelo e-mail ${PRIVACY_EMAIL}.</p>
`;

const deletion = `
<p>Você pode excluir sua conta do aplicativo Mipo a qualquer momento.</p>
<h2>Pelo app</h2>
<p>Perfil → Configurações → "Excluir conta" → confirme com sua senha. A exclusão é imediata.</p>
<h2>Sem acesso ao app</h2>
<p>Envie um e-mail para <strong>${PRIVACY_EMAIL}</strong> a partir do e-mail cadastrado (ou informando o telefone cadastrado), com o assunto "Excluir minha conta". Confirmamos a titularidade e concluímos a exclusão em até 15 dias.</p>
<h2>O que é apagado</h2>
<ul>
<li>Nome, apelido, e-mail, telefone, data de nascimento, cidade, bio e foto de perfil.</li>
<li>Publicações, comentários, curtidas, reações e imagens enviadas.</li>
<li>Texto e imagens das mensagens de chat (a mensagem aparece como apagada para os outros participantes).</li>
<li>Amizades, notificações, preferências, histórico de visitas à loja, histórico de jogos, participação em "procuro jogadores" e avaliações.</li>
<li>Sessões ativas e token de notificação.</li>
</ul>
<h2>O que pode ser mantido</h2>
<ul>
<li>Comandas e pedidos, sem o seu nome, por até 24 meses para controle interno da loja.</li>
<li>Pontuações dos jogos do mês, exibidas como "Conta excluída", para manter o histórico do ranking.</li>
<li>Registros de acesso por 6 meses (Marco Civil da Internet) e dados necessários para atender ordem judicial ou exercer direitos em processos.</li>
</ul>
`;

const pages: Record<LegalPage, { title: string; body: string }> = {
  privacidade: { title: 'Política de privacidade', body: privacy },
  termos: { title: 'Termos de uso', body: terms },
  'diretrizes-da-comunidade': {
    title: 'Diretrizes da comunidade',
    body: community,
  },
  'exclusao-de-conta': { title: 'Excluir sua conta', body: deletion },
};

export function renderLegalPage(page: LegalPage) {
  const { title, body } = pages[page];
  return layout(title, body);
}

export const LEGAL_PAGES = Object.keys(pages) as LegalPage[];
