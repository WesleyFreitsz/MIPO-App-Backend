import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ObjectStorageService } from 'src/uploads/object-storage.service';

export const DELETED_ACCOUNT_NAME = 'Conta excluída';

type Row = Record<string, unknown>;

// Ordem importa: filhos antes dos pais quando não há cascade.
const ERASE_STATEMENTS: { table: string; sql: string }[] = [
  { table: 'post_likes', sql: 'DELETE FROM post_likes WHERE "userId" = $1' },
  {
    table: 'post_comments',
    sql: 'DELETE FROM post_comments WHERE "userId" = $1',
  },
  { table: 'posts', sql: 'DELETE FROM posts WHERE "userId" = $1' },
  {
    table: 'chat_messages',
    sql: `UPDATE chat_messages SET content = '', "imageUrl" = NULL, "isDeleted" = true WHERE "userId" = $1`,
  },
  {
    table: 'chat_message_reactions',
    sql: 'DELETE FROM chat_message_reactions WHERE "userId" = $1',
  },
  {
    table: 'chat_members',
    sql: 'UPDATE chat_members SET "lastSeenAt" = NULL WHERE "userId" = $1',
  },
  {
    table: 'notifications',
    sql: 'DELETE FROM notifications WHERE "userId" = $1',
  },
  {
    table: 'notification_preferences',
    sql: 'DELETE FROM notification_preferences WHERE "userId" = $1',
  },
  {
    table: 'order_reviews',
    sql: 'DELETE FROM order_reviews WHERE "userId" = $1',
  },
  {
    table: 'visit_reviews',
    sql: 'DELETE FROM visit_reviews WHERE "userId" = $1',
  },
  {
    table: 'store_visits',
    sql: 'DELETE FROM store_visits WHERE "userId" = $1',
  },
  {
    table: 'game_play_players',
    sql: 'DELETE FROM game_play_players WHERE "userId" = $1',
  },
  { table: 'game_plays', sql: 'DELETE FROM game_plays WHERE "userId" = $1' },
  {
    table: 'game_user_marks',
    sql: 'DELETE FROM game_user_marks WHERE "userId" = $1',
  },
  {
    table: 'play_call_members',
    sql: 'DELETE FROM play_call_members WHERE "userId" = $1',
  },
  { table: 'play_calls', sql: 'DELETE FROM play_calls WHERE "creatorId" = $1' },
  {
    table: 'order_tabs',
    sql: `UPDATE order_tabs SET "customerName" = '${DELETED_ACCOUNT_NAME}' WHERE "userId" = $1`,
  },
];

const EXPORT_QUERIES: { key: string; table: string; sql: string }[] = [
  {
    key: 'perfil',
    table: 'user',
    sql: `SELECT id, name, nickname, email, "phoneNumber", "birthDate", city, bio, "avatarUrl", role, coins, participation,
      "showInStorePresence", "showLastSeen", "termsVersion", "termsAcceptedAt", "createdAt" FROM "user" WHERE id = $1`,
  },
  {
    key: 'posts',
    table: 'posts',
    sql: 'SELECT * FROM posts WHERE "userId" = $1 ORDER BY "createdAt"',
  },
  {
    key: 'comentarios',
    table: 'post_comments',
    sql: 'SELECT * FROM post_comments WHERE "userId" = $1 ORDER BY "createdAt"',
  },
  {
    key: 'curtidas',
    table: 'post_likes',
    sql: 'SELECT "postId", "createdAt" FROM post_likes WHERE "userId" = $1',
  },
  {
    key: 'mensagensEnviadas',
    table: 'chat_messages',
    sql: 'SELECT id, "chatId", content, "imageUrl", "isDeleted", "createdAt" FROM chat_messages WHERE "userId" = $1 ORDER BY "createdAt"',
  },
  {
    key: 'amizades',
    table: 'friendships',
    sql: 'SELECT "userId", "friendId", status, "createdAt" FROM friendships WHERE "userId" = $1 OR "friendId" = $1',
  },
  {
    key: 'visitasNaLoja',
    table: 'store_visits',
    sql: 'SELECT id, "checkedInAt", "checkedOutAt", source FROM store_visits WHERE "userId" = $1 ORDER BY "checkedInAt"',
  },
  {
    key: 'comandas',
    table: 'order_tabs',
    sql: 'SELECT * FROM order_tabs WHERE "userId" = $1 ORDER BY "openedAt"',
  },
  {
    key: 'pedidos',
    table: 'orders',
    sql: `SELECT o.id, o."tabId", o.status, o."tableLabel", o.note, o."createdAt",
      json_agg(json_build_object('nome', i."nameSnapshot", 'quantidade', i.quantity, 'precoUnitario', i."unitPrice", 'tipo', i.kind)) AS itens
      FROM orders o JOIN order_tabs t ON t.id = o."tabId" LEFT JOIN order_items i ON i."orderId" = o.id
      WHERE t."userId" = $1 GROUP BY o.id ORDER BY o."createdAt"`,
  },
  {
    key: 'conquistas',
    table: 'user_achievements',
    sql: `SELECT a.title, ua."acquiredAt" FROM user_achievements ua JOIN achievements a ON a.id = ua."achievementId" WHERE ua."userId" = $1`,
  },
  {
    key: 'resgatesDeRecompensas',
    table: 'reward_redemptions',
    sql: 'SELECT * FROM reward_redemptions WHERE "userId" = $1 ORDER BY "createdAt"',
  },
  {
    key: 'historicoDeJogos',
    table: 'game_plays',
    sql: `SELECT p.id, g.name AS jogo, p."playedAt", p.source, p.note FROM game_plays p JOIN games g ON g.id = p."gameId"
      WHERE p."userId" = $1 OR p.id IN (SELECT "playId" FROM game_play_players WHERE "userId" = $1) ORDER BY p."playedAt"`,
  },
  {
    key: 'marcacoesDeJogos',
    table: 'game_user_marks',
    sql: `SELECT g.name AS jogo, m.* FROM game_user_marks m JOIN games g ON g.id = m."gameId" WHERE m."userId" = $1`,
  },
  {
    key: 'pontuacoesJogosDoMes',
    table: 'monthly_game_scores',
    sql: 'SELECT * FROM monthly_game_scores WHERE "userId" = $1 ORDER BY "createdAt"',
  },
  {
    key: 'avaliacoesDeVisitas',
    table: 'visit_reviews',
    sql: 'SELECT * FROM visit_reviews WHERE "userId" = $1',
  },
  {
    key: 'avaliacoesDePedidos',
    table: 'order_reviews',
    sql: 'SELECT * FROM order_reviews WHERE "userId" = $1',
  },
  {
    key: 'procuroJogadores',
    table: 'play_calls',
    sql: `SELECT * FROM play_calls WHERE "creatorId" = $1 OR id IN (SELECT "callId" FROM play_call_members WHERE "userId" = $1)`,
  },
  {
    key: 'denunciasFeitas',
    table: 'reports',
    sql: 'SELECT id, reason, type, "createdAt", dismissed FROM reports WHERE "reporterUserId" = $1',
  },
  {
    key: 'preferenciasDeNotificacao',
    table: 'notification_preferences',
    sql: 'SELECT type, enabled FROM notification_preferences WHERE "userId" = $1',
  },
  {
    key: 'notificacoes',
    table: 'notifications',
    sql: 'SELECT title, message, "createdAt", "isRead" FROM notifications WHERE "userId" = $1 ORDER BY "createdAt"',
  },
];

const MEDIA_REFERENCES = [
  'SELECT 1 FROM "user" WHERE "avatarUrl" = $1',
  'SELECT 1 FROM posts WHERE "imageUrl" = $1',
  'SELECT 1 FROM chat_messages WHERE "imageUrl" = $1',
  'SELECT 1 FROM chats WHERE "imageUrl" = $1',
];

@Injectable()
export class AccountDataService {
  private readonly logger = new Logger(AccountDataService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  /** Apaga/anonimiza o conteúdo do usuário e devolve as URLs de mídia que ficaram órfãs. */
  async eraseUserData(manager: EntityManager, userId: string) {
    const tables = await this.existingTables(manager);
    const media = await this.collectMedia(manager, tables, userId);
    for (const statement of ERASE_STATEMENTS) {
      if (tables.has(statement.table))
        await manager.query(statement.sql, [userId]);
    }
    return media;
  }

  /** Remove do storage as mídias que nenhuma outra linha referencia (uploads são deduplicados por hash). */
  async deleteOrphanMedia(urls: string[]) {
    for (const url of new Set(urls)) {
      try {
        if (await this.isReferenced(url)) continue;
        await this.objectStorage.deleteByUrl(url);
        await this.dataSource.query('DELETE FROM uploads WHERE url = $1', [
          url,
        ]);
      } catch (error) {
        this.logger.warn(
          `Falha ao apagar mídia de conta excluída: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  async exportUserData(userId: string) {
    const tables = await this.existingTables(this.dataSource.manager);
    const data: Record<string, Row[] | Row | null> = {
      geradoEm: { data: new Date().toISOString() },
    };
    for (const query of EXPORT_QUERIES) {
      if (!tables.has(query.table)) continue;
      const rows = await this.dataSource.query<Row[]>(query.sql, [userId]);
      data[query.key] = query.key === 'perfil' ? (rows[0] ?? null) : rows;
    }
    return data;
  }

  private async existingTables(manager: EntityManager) {
    const rows = await manager.query<{ tablename: string }[]>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    return new Set(rows.map((row) => row.tablename));
  }

  private async collectMedia(
    manager: EntityManager,
    tables: Set<string>,
    userId: string,
  ) {
    const queries = [
      {
        table: 'user',
        sql: 'SELECT "avatarUrl" AS url FROM "user" WHERE id = $1',
      },
      {
        table: 'posts',
        sql: 'SELECT "imageUrl" AS url FROM posts WHERE "userId" = $1',
      },
      {
        table: 'chat_messages',
        sql: 'SELECT "imageUrl" AS url FROM chat_messages WHERE "userId" = $1',
      },
    ];
    const urls: string[] = [];
    for (const query of queries) {
      if (!tables.has(query.table)) continue;
      const rows = await manager.query<{ url: string | null }[]>(query.sql, [
        userId,
      ]);
      for (const row of rows)
        if (row.url?.startsWith('http')) urls.push(row.url);
    }
    return urls;
  }

  private async isReferenced(url: string) {
    for (const sql of MEDIA_REFERENCES) {
      const rows = await this.dataSource.query<unknown[]>(`${sql} LIMIT 1`, [
        url,
      ]);
      if (rows.length > 0) return true;
    }
    return false;
  }
}
