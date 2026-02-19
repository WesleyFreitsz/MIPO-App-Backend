import { IsString, IsOptional, Matches, IsInt } from 'class-validator';

export class UpdateProfileDto {
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
  avatarUrl?: string;

  @IsInt()
  @IsOptional()
  age?: number;
}
