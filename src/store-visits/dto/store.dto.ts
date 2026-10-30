import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class StoreCheckInDto {
  @IsString()
  @Length(8, 64)
  code: string;
}

export class StaffCheckInDto {
  @IsUUID()
  userId: string;
}

export class StaffUsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
