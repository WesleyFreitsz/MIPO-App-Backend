import { UserRole } from 'src/users/entities/user.entity';

export interface AuthenticatedUser {
  userId: string;
  name: string;
  role: UserRole;
}

export interface JwtPayload {
  sub: string;
  name: string;
  role: UserRole;
}
