import { IsNumber, IsOptional, Matches } from 'class-validator';
import { DATE_PATTERN, TIME_PATTERN } from '../room-time.util';

export class ReserveSalinhaDto {
  @Matches(DATE_PATTERN, { message: 'Data inválida' })
  date: string;

  @Matches(TIME_PATTERN, { message: 'Horário de início inválido' })
  startTime: string;

  @Matches(TIME_PATTERN, { message: 'Horário de término inválido' })
  endTime: string;

  @IsOptional()
  @IsNumber()
  totalPrice?: number;
}
