import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateNotificationTokenDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  token?: string | null;
}
