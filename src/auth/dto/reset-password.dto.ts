import { IsEmail, IsString, Length, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  email: string;

  @IsString()
  @Length(6, 6, { message: 'O código deve ter 6 dígitos' })
  @Matches(/^\d{6}$/, { message: 'O código deve ter 6 dígitos' })
  code: string;

  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  newPassword: string;
}
