import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateOrderReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
}

export class CreateVisitReviewDto extends CreateOrderReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
