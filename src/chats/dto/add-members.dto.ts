import { IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AddMembersDto {
  @IsArray()
  @IsUUID('4', { each: true })
  memberIds: string[];
}
