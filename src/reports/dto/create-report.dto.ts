import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateReportDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason: string;

  @IsUUID()
  reportedUserId: string;

  @IsOptional()
  @IsUUID()
  postId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(/^https?:\/\//, { message: 'URL de imagem inválida' })
  imageUrl?: string | null;
}
