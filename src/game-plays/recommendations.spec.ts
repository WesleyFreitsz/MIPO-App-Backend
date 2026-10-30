import { recommendGames, RecommendationSignals } from './recommendations';

const game = (id: string, category: string[], isFeatured = false) => ({
  id,
  name: id,
  imageUrl: null,
  category,
  isFeatured,
});

const signals = (
  overrides: Partial<RecommendationSignals>,
): RecommendationSignals => ({
  games: [],
  myPlayCounts: new Map(),
  favoriteIds: new Set(),
  wantsToPlayIds: new Set(),
  friendPlayers: new Map(),
  ratings: new Map(),
  ...overrides,
});

describe('recommendGames', () => {
  it('prioriza "quero jogar" e explica o motivo', () => {
    const result = recommendGames(
      signals({
        games: [game('azul', ['Abstrato']), game('catan', ['Estratégia'])],
        wantsToPlayIds: new Set(['catan']),
        friendPlayers: new Map([['azul', 1]]),
      }),
    );
    expect(result.map((r) => r.id)).toEqual(['catan', 'azul']);
    expect(result[0].reason).toBe('Está na sua lista de quero jogar');
    expect(result[1].reason).toBe('Um amigo jogou');
  });

  it('usa a categoria que a pessoa mais joga e tira o que já jogou demais', () => {
    const result = recommendGames(
      signals({
        games: [
          game('jogado', ['Estratégia']),
          game('novo', ['Estratégia']),
          game('outro', ['Party']),
        ],
        myPlayCounts: new Map([['jogado', 3]]),
      }),
    );
    expect(result.map((r) => r.id)).toEqual(['novo']);
    expect(result[0].reason).toBe('Porque você curte Estratégia');
  });

  it('sem histórico, cai nos destaques da Mipo', () => {
    const result = recommendGames(
      signals({ games: [game('a', [], true), game('b', [])] }),
    );
    expect(result).toEqual([
      { id: 'a', name: 'a', imageUrl: null, reason: 'Destaque da Mipo' },
    ]);
  });
});
