import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string;
}
