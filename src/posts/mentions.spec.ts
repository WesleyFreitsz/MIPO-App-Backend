import { extractMentions } from './mentions';

describe('extractMentions', () => {
  it('extrai nicknames únicos sem diferenciar maiúsculas', () => {
    expect(
      extractMentions('Valeu @Ana_1 e @bia! Bora de novo, @ana_1? mail@x'),
    ).toEqual(['ana_1', 'bia', 'x']);
  });

  it('retorna vazio sem menções', () => {
    expect(extractMentions('sem ninguém aqui')).toEqual([]);
  });
});
