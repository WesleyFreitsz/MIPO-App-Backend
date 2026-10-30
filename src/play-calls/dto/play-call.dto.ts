import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PlayCallMode } from '../entities/play-call.entity';

export class PlayCallsQueryDto {
  @IsEnum(PlayCallMode)
  mode: PlayCallMode;
}

export class CreatePlayCallDto {
  @IsEnum(PlayCallMode)
  mode: PlayCallMode;

  @IsOptional()
  @IsUUID()
  gameId?: string;

  @ValidateIf((dto: CreatePlayCallDto) => !dto.gameId)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @ValidateIf((dto: CreatePlayCallDto) => dto.mode === PlayCallMode.SCHEDULED)
  @IsDateString()
  scheduledFor?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  slotsNeeded: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
