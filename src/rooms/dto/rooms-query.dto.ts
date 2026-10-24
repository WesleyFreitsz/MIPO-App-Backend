import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { RoomType } from '../entities/room.entity';
import { DATE_PATTERN, TIME_PATTERN } from '../room-time.util';

export class RoomsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(RoomType)
  type?: RoomType;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'Data inválida' })
  date?: string;
}

export class RoomParticipantsQueryDto {
  @Matches(DATE_PATTERN, { message: 'Data inválida' })
  date: string;

  @Matches(TIME_PATTERN, { message: 'Horário de início inválido' })
  startTime: string;

  @Matches(TIME_PATTERN, { message: 'Horário de término inválido' })
  endTime: string;
}

export class RejectReservationDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
