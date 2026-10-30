import {
  IsOptional,
  IsUUID,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MaxLength(5000)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(/^https?:\/\//, { message: 'URL de mídia inválida' })
  imageUrl?: string;

  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientId?: string;
}
