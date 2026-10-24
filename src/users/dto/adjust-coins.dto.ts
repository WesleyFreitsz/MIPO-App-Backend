import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class AdjustCoinsDto {
  @IsOptional()
  @IsInt()
  @Min(-100_000)
  @Max(100_000)
  amount?: number;
}
