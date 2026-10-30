import { toCsv } from './finance.service';
import { Transaction } from './entities/transaction.entity';

describe('toCsv', () => {
  it('escapa aspas e formata valor no padrão brasileiro', () => {
    const csv = toCsv([
      {
        id: '1',
        description: 'Mesa "VIP"',
        value: 12.5,
        type: 'in',
        createdAt: new Date('2026-10-01T12:00:00Z'),
      } as Transaction,
    ]);
    expect(csv.split('\n')).toEqual([
      'data;descricao;tipo;valor',
      '2026-10-01;"Mesa ""VIP""";entrada;12,50',
    ]);
  });
});
