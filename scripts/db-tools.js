// Uso: node scripts/db-tools.js <backup|migrate> — lê DIRECT_URL do .env.
const { readFileSync, mkdirSync, writeFileSync } = require('fs');
const { join } = require('path');
const { Client } = require('pg');

const SQL_ORDER = [
  'remove-salinha.sql',
  'conta-recompensas.sql',
  'eventos-notificacoes.sql',
  'frente-a-chat.sql',
  'monthly-games.sql',
  'loja-checkin.sql',
  'loja-pedidos.sql',
  'social-loja-help-enum.sql',
  'social-loja-historico.sql',
  'social-loja-avaliacoes.sql',
  'social-loja-procuro.sql',
  'conformidade.sql',
];

function databaseUrl() {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
  const line = readFileSync(join(__dirname, '..', '.env'), 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('DIRECT_URL='));
  if (!line) throw new Error('DIRECT_URL não encontrado no .env');
  return line.slice('DIRECT_URL='.length).trim();
}

async function backup(db) {
  const dir = join(__dirname, '..', 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
  mkdirSync(dir, { recursive: true });
  const { rows: tables } = await db.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  for (const { tablename } of tables) {
    const { rows } = await db.query(`SELECT * FROM public."${tablename}"`);
    writeFileSync(join(dir, `${tablename}.json`), JSON.stringify(rows));
    console.log(`${tablename}: ${rows.length} linha(s)`);
  }
  console.log(`Backup salvo em ${dir}`);
}

async function migrate(db) {
  for (const file of SQL_ORDER) {
    // Cada arquivo vai numa única query simples: os que têm BEGIN/COMMIT controlam a própria transação.
    await db.query(readFileSync(join(__dirname, '..', 'sql', file), 'utf8'));
    console.log(`ok ${file}`);
  }
}

(async () => {
  const command = process.argv[2];
  if (!['backup', 'migrate'].includes(command)) throw new Error('Use backup ou migrate');
  const db = new Client({ connectionString: databaseUrl(), ssl: { rejectUnauthorized: true } });
  await db.connect();
  try {
    await (command === 'backup' ? backup(db) : migrate(db));
  } finally {
    await db.end();
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
