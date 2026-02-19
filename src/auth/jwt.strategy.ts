import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'MIPO_SEGREDO_FORTE', // Mesmo segredo do .env
    });
  }

  async validate(payload: any) {
    // Retorna os dados que ficarão disponíveis em req.user
    return { userId: payload.sub, name: payload.name, role: payload.role };
  }
}
