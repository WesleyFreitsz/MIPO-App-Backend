import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Login obrigatório' })
  @MaxLength(254)
  login: string; // Pode ser Email ou Telefone

  @IsString()
  @IsNotEmpty({ message: 'Senha obrigatória' })
  @MaxLength(1024)
  password: string;
}
