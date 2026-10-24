import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRewardDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title: string;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  price: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock: number;
}

export class UpdateRewardDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock?: number;
}
