import { QueryFailedError } from 'typeorm';

const POSTGRES_UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown) {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code ===
      POSTGRES_UNIQUE_VIOLATION
  );
}
