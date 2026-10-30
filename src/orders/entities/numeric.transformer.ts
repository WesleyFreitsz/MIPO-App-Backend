import { ValueTransformer } from 'typeorm';

// O driver do Postgres devolve numeric como string; a API expõe number.
export const numericTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
