import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(/^https?:\/\//, { message: 'URL de mídia inválida' })
  imageUrl?: string;
}
