import { BadRequestException } from '@nestjs/common';
import { assertAllowedContent, containsBlockedContent } from './content-filter';

describe('filtro de conteúdo', () => {
  it('pega variações com acento, maiúsculas, letras repetidas e leetspeak', () => {
    expect(containsBlockedContent('Que PORRAAA é essa')).toBe(true);
    expect(containsBlockedContent('seu 0t4r1o')).toBe(true);
    expect(containsBlockedContent('desgraçado')).toBe(true);
    expect(containsBlockedContent('vai tomar no c.u')).toBe(false);
    expect(containsBlockedContent('vai tomar no cu!')).toBe(true);
  });

  it('não bloqueia palavras comuns que contêm um termo', () => {
    expect(containsBlockedContent('Computador e disputa de Catan')).toBe(false);
    expect(containsBlockedContent('o carro é caro')).toBe(false);
    expect(containsBlockedContent(null)).toBe(false);
  });

  it('lança 400 quando algum texto é bloqueado', () => {
    expect(() => assertAllowedContent('ok', 'porra')).toThrow(
      BadRequestException,
    );
    expect(() => assertAllowedContent('bora jogar?', undefined)).not.toThrow();
  });
});
