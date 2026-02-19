import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Login obrigatório' })
  login: string; // Pode ser Email ou Telefone

  @IsString()
  @IsNotEmpty({ message: 'Senha obrigatória' })
  password: string;
}
