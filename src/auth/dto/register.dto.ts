import {
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsDateString,
  Equals,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  @MinLength(3, { message: 'O nome deve ter pelo menos 3 caracteres' })
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres' })
  password: string;

  @IsDateString({ strict: true }, { message: 'Data de nascimento inválida' })
  birthDate: string;

  @Equals(true, {
    message: 'É preciso aceitar os termos de uso e a política de privacidade',
  })
  acceptTerms: boolean;

  @IsString()
  @MaxLength(20)
  termsVersion: string;

  // O campo login aceita tanto E-mail quanto Telefone
  // O backend vai decidir qual é qual verificando se tem "@"
  @IsString()
  @IsNotEmpty({ message: 'Login (Email ou Telefone) é obrigatório' })
  @MaxLength(254)
  login: string;
}
