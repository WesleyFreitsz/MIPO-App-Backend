import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  refreshToken: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  currentPassword: string;

  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres' })
  newPassword: string;
}

export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  password: string;
}
