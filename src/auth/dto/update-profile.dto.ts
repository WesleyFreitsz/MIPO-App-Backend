import {
  IsBoolean,
  IsString,
  IsOptional,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(100)
  name?: string; // <-- Adicionado para receber o nome do frontend

  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Nickname deve conter apenas letras, números e underline',
  })
  nickname?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  bio?: string; // <-- Adicionado para receber a biografia

  @IsString()
  @IsOptional()
  @MaxLength(8_000_000)
  @Matches(/^(https?:\/\/|data:image\/)/, {
    message: 'Avatar inválido',
  })
  avatarUrl?: string;

  @IsBoolean()
  @IsOptional()
  showInStorePresence?: boolean;

  @IsBoolean()
  @IsOptional()
  showLastSeen?: boolean;
}
