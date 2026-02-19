import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @MinLength(1)
  content: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
