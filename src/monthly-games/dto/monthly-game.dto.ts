import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class MonthlyPeriodQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}

export class CreateMonthlyGameDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsUUID()
  gameId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  prizeFirst?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  prizeSecond?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  prizeThird?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  rules?: string;
}

export class UpdateMonthlyGameDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  prizeFirst?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  prizeSecond?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  prizeThird?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  rules?: string;
}

export class SubmitMonthlyGameScoreDto {
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  score: number;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(/^https?:\/\//, { message: 'URL de imagem inválida' })
  proofImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ManualMonthlyGameScoreDto {
  @IsUUID()
  userId: string;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  score: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectMonthlyGameScoreDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  reason: string;
}
