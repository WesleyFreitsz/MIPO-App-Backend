import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EventSpace } from '../entities/event.entity';

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(EventSpace)
  space?: EventSpace;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  customLocation?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  bannerUrl?: string | null;

  @IsOptional()
  @IsDateString()
  dateTime?: string;
}
