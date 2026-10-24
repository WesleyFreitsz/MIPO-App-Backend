import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { JwtPayload } from './authenticated-user.interface';

@Injectable()
export class SocketAuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async authenticate(client: Socket): Promise<string | null> {
    const token = this.extractToken(client);
    if (!token) return null;

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const user = await this.usersRepository.findOne({
        where: { id: payload.sub },
        select: { id: true, banned: true },
      });
      if (!user || user.banned) return null;
      return user.id;
    } catch {
      return null;
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken: unknown = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken.replace(/^Bearer\s+/i, '');
    }

    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }
    return null;
  }
}
