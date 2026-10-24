import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateChatDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string;
}
