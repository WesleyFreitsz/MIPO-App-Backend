import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
