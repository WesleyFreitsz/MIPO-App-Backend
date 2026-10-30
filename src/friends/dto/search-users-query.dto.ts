import { IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class SearchUsersQueryDto extends PaginationQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  q: string;
}
