import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { UserRole } from '../entities/user.entity';

export class AdminUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class SetRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}
