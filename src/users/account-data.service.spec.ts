import { DataSource, EntityManager } from 'typeorm';
import { ObjectStorageService } from 'src/uploads/object-storage.service';
import { AccountDataService } from './account-data.service';

function fakeDb(
  tables: string[],
  rowsFor: (sql: string) => unknown[] = () => [],
) {
  const executed: string[] = [];
  const query = jest.fn((sql: string) => {
    executed.push(sql);
    if (sql.includes('pg_tables')) {
      return Promise.resolve(tables.map((tablename) => ({ tablename })));
    }
    return Promise.resolve(rowsFor(sql));
  });
  return { executed, query };
}

describe('AccountDataService', () => {
  const storage = { deleteByUrl: jest.fn() };

  it('apaga conteúdo, anonimiza chat e comanda e pula tabelas que não existem', async () => {
    const db = fakeDb(
      [
        'user',
        'posts',
        'post_likes',
        'post_comments',
        'chat_messages',
        'order_tabs',
      ],
      (sql) =>
        sql.startsWith('SELECT "avatarUrl"')
          ? [{ url: 'https://cdn/x/avatar.jpg' }]
          : [],
    );
    const service = new AccountDataService(
      {} as DataSource,
      storage as unknown as ObjectStorageService,
    );

    const media = await service.eraseUserData(
      db as unknown as EntityManager,
      'u1',
    );

    expect(media).toEqual(['https://cdn/x/avatar.jpg']);
    expect(db.executed).toContain('DELETE FROM posts WHERE "userId" = $1');
    expect(
      db.executed.some((sql) =>
        sql.startsWith("UPDATE chat_messages SET content = ''"),
      ),
    ).toBe(true);
    expect(
      db.executed.some((sql) =>
        sql.includes(`"customerName" = 'Conta excluída'`),
      ),
    ).toBe(true);
    expect(db.executed.some((sql) => sql.includes('visit_reviews'))).toBe(
      false,
    );
  });

  it('não apaga do storage mídia ainda usada por outra linha', async () => {
    const db = fakeDb([], (sql) =>
      sql.includes('FROM posts') ? [{ 1: 1 }] : [],
    );
    const service = new AccountDataService(
      db as unknown as DataSource,
      storage as unknown as ObjectStorageService,
    );

    await service.deleteOrphanMedia(['https://cdn/x/compartilhada.jpg']);

    expect(storage.deleteByUrl).not.toHaveBeenCalled();
  });

  it('exporta só as tabelas existentes, com o perfil como objeto', async () => {
    const db = fakeDb(['user', 'posts'], (sql) =>
      sql.includes('FROM "user"')
        ? [{ id: 'u1', name: 'Ana' }]
        : [{ id: 'p1' }],
    );
    const service = new AccountDataService(
      { query: db.query, manager: db } as unknown as DataSource,
      storage as unknown as ObjectStorageService,
    );

    const data = await service.exportUserData('u1');

    expect(data.perfil).toEqual({ id: 'u1', name: 'Ana' });
    expect(data.posts).toEqual([{ id: 'p1' }]);
    expect(data).not.toHaveProperty('comandas');
  });
});
