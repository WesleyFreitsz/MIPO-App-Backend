import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'crypto';

interface ThrottledRequest {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

// Clientes na Wi-Fi da loja compartilham o mesmo IP; quem está logado é contado pela sessão.
@Injectable()
export class SessionThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as ThrottledRequest;
    const authorization = request.headers.authorization;
    if (
      typeof authorization === 'string' &&
      authorization.startsWith('Bearer ')
    ) {
      return Promise.resolve(
        `session:${createHash('sha256').update(authorization).digest('hex').slice(0, 32)}`,
      );
    }
    return Promise.resolve(request.ip ?? 'unknown');
  }
}
