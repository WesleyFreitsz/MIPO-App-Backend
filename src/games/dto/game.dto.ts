import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateGameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  category: string[];

  @IsInt()
  @Min(1)
  @Max(100)
  minPlayers: number;

  @IsInt()
  @Min(1)
  @Max(100)
  maxPlayers: number;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  videoUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}

export class UpdateGameDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  category?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  minPlayers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxPlayers?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  videoUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class GamesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  players?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  isFeatured?: 'true' | 'false';

  @IsOptional()
  @IsIn(['true', 'false', 'all'])
  active?: 'true' | 'false' | 'all';
}

export class UpdateGameUserMarkDto {
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @IsOptional()
  @IsBoolean()
  wantsToPlay?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  review?: string | null;
}
