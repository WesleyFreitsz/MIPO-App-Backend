import {
  IsIn,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTransactionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  description: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99_999_999.99)
  value: number;

  @IsIn(['in', 'out'])
  type: 'in' | 'out';
}
