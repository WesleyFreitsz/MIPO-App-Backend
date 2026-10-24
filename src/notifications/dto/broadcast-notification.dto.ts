import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class BroadcastNotificationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;
}
