import { IsUUID } from 'class-validator';

export class CreateFriendshipDto {
  @IsUUID()
  friendId: string;
}
