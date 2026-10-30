import { BadRequestException } from '@nestjs/common';

// shortcut: lista curta e fixa de termos; trocar por serviço de moderação se o volume de denúncias crescer.
const BLOCKED_TERMS = [
  'caralho',
  'krl',
  'porra',
  'pqp',
  'puta',
  'puto',
  'putaria',
  'fdp',
  'foda',
  'foder',
  'fodase',
  'vsf',
  'vtnc',
  'merda',
  'buceta',
  'boceta',
  'xoxota',
  'xereca',
  'piroca',
  'punheta',
  'siririca',
  'arrombado',
  'arrombada',
  'cuzao',
  'escroto',
  'escrota',
  'otario',
  'otaria',
  'vagabundo',
  'vagabunda',
  'vadia',
  'corno',
  'desgracado',
  'desgracada',
  'retardado',
  'retardada',
  'viado',
  'viadinho',
  'baitola',
  'traveco',
  'sapatao',
  'crioulo',
  'macaco imundo',
  'filho da puta',
  'vai se foder',
  'vai tomar no cu',
  'toma no cu',
  'se mata',
  'vai se matar',
];

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[013457@$]/g, (char) => LEET[char])
    .replace(/[^a-z]+/g, ' ')
    .replace(/([a-z])\1+/g, '$1')
    .trim();
}

const NORMALIZED_TERMS = BLOCKED_TERMS.map(normalize);

export function containsBlockedContent(text: string | null | undefined) {
  if (!text) return false;
  const padded = ` ${normalize(text)} `;
  return NORMALIZED_TERMS.some((term) => padded.includes(` ${term} `));
}

export function assertAllowedContent(...texts: (string | null | undefined)[]) {
  if (texts.some(containsBlockedContent)) {
    throw new BadRequestException(
      'Conteúdo não permitido pelas diretrizes da comunidade.',
    );
  }
}
