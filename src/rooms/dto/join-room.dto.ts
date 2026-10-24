import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { DATE_PATTERN, TIME_PATTERN } from '../room-time.util';

export class JoinRoomDto {
  @Matches(DATE_PATTERN, { message: 'Data inválida' })
  date: string;

  @Matches(TIME_PATTERN, { message: 'Horário de início inválido' })
  startTime: string;

  @Matches(TIME_PATTERN, { message: 'Horário de término inválido' })
  endTime: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  activity?: string;

  @IsOptional()
  @IsIn(['game', 'custom'])
  activityType?: 'game' | 'custom';

  @IsOptional()
  @IsBoolean()
  isActivityPublic?: boolean;
}
