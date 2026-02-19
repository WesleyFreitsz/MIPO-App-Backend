import { IsString, IsInt, MinLength, Min, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  @MinLength(3, { message: 'O nome deve ter pelo menos 3 caracteres' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  password: string;

  @IsInt({ message: 'A idade deve ser um número inteiro' })
  @Min(12, { message: 'Idade mínima de 12 anos' })
  age: number;

  // O campo login aceita tanto E-mail quanto Telefone
  // O backend vai decidir qual é qual verificando se tem "@"
  @IsString()
  @IsNotEmpty({ message: 'Login (Email ou Telefone) é obrigatório' })
  login: string;
}
