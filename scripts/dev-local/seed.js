// Popula o backend local de teste: node scripts/dev-local/seed.js <register|data> [baseUrl]
const { readFileSync } = require('fs');
const { join } = require('path');

const step = process.argv[2];
const base = process.argv[3] ?? 'http://127.0.0.1:3000';
const creds = JSON.parse(readFileSync(join(__dirname, 'credenciais.json'), 'utf8'));

async function call(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function register() {
  const { version } = await call('GET', '/legal/version');
  for (const [name, account] of Object.entries(creds).filter(([k]) => !k.startsWith('_'))) {
    await call('POST', '/auth/register', {
      name,
      login: account.login,
      password: account.password,
      birthDate: '1990-01-01',
      acceptTerms: true,
      termsVersion: version,
    });
    console.log('conta criada:', name);
  }
}

async function data() {
  const { access_token: token } = await call('POST', '/auth/login', creds.admin);
  const games = [
    { name: 'Azul', category: ['Abstrato', 'Família'], minPlayers: 2, maxPlayers: 4, isFeatured: true },
    { name: 'Catan', category: ['Estratégia'], minPlayers: 3, maxPlayers: 4 },
    { name: 'Dixit', category: ['Party'], minPlayers: 3, maxPlayers: 6 },
  ];
  const created = [];
  for (const game of games) created.push(await call('POST', '/games', game, token));
  const menu = [
    { name: 'Hambúrguer da casa', category: 'FOOD', price: 32.5, dailySpecial: true },
    { name: 'Batata frita', category: 'FOOD', price: 22 },
    { name: 'Refrigerante', category: 'DRINK', price: 7 },
    { name: 'Brownie', category: 'DESSERT', price: 15, dailySpecial: true },
  ];
  for (const item of menu) await call('POST', '/menu', item, token);
  const now = new Date();
  await call('POST', '/monthly-games', {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    gameId: created[0].id,
    prizeFirst: 'R$ 100 em consumação',
    prizeSecond: 'Brownie + refri',
    prizeThird: '50 moedas',
  }, token);
  const code = await call('POST', '/store/code/rotate', null, token);
  console.log('jogos, cardápio e jogo do mês criados');
  console.log('QR de check-in:', code.qrContent);
}

(step === 'register' ? register() : data()).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
