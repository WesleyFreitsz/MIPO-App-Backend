import { IsBoolean, IsOptional } from 'class-validator';

export class SetBannedDto {
  @IsOptional()
  @IsBoolean()
  banned?: boolean;
}
