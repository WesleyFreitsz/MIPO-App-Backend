import { IsString, IsOptional, Matches, IsInt } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  name?: string; // <-- Adicionado para receber o nome do frontend

  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Nickname deve conter apenas letras, números e underline',
  })
  nickname?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  bio?: string; // <-- Adicionado para receber a biografia

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsInt()
  @IsOptional()
  age?: number;
}
