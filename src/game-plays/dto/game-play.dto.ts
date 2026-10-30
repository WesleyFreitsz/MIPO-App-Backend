import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateGamePlayDto {
  @IsOptional()
  @IsDateString()
  playedAt?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  playerIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
