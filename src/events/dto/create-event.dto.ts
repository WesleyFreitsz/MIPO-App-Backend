import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EventSpace } from '../entities/event.entity';

export class CreateEventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description: string;

  @IsEnum(EventSpace)
  space: EventSpace;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  customLocation?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  bannerUrl?: string | null;

  @IsDateString()
  dateTime: string;
}
