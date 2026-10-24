import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(/^https?:\/\//, { message: 'URL de imagem inválida' })
  imageUrl?: string | null;
}
