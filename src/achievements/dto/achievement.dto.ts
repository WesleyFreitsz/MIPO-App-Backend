import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const CONDITION_PATTERN = /^[a-z_]+\.[a-z_]+\.\d+$/;

export class CreateAchievementDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  icon: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @Matches(CONDITION_PATTERN, { message: 'Condição inválida' })
  condition?: string | null;

  @IsOptional()
  @IsUUID()
  rarityId?: string | null;

  @IsOptional()
  @IsUUID()
  eventId?: string | null;
}

export class UpdateAchievementDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @Matches(CONDITION_PATTERN, { message: 'Condição inválida' })
  condition?: string | null;

  @IsOptional()
  @IsUUID()
  rarityId?: string | null;

  @IsOptional()
  @IsUUID()
  eventId?: string | null;
}

export class AwardAchievementDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  userIds: string[];

  @IsUUID()
  achievementId: string;
}

export class SetHighlightsDto {
  @IsArray()
  @ArrayMaxSize(3)
  @IsUUID('4', { each: true })
  achievementIds: string[];
}

export class RarityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @IsString()
  @Matches(/^#[0-9a-fA-F]{3,8}$/, { message: 'Cor inválida' })
  color: string;
}

export class RarityOrderDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  rarityIds: string[];
}

export class SyncAchievementsDto {
  @IsString()
  @Matches(/^[a-z_]+\.[a-z_]+$/, { message: 'Prefixo inválido' })
  prefix: string;

  @IsInt()
  @Min(0)
  count: number;
}
