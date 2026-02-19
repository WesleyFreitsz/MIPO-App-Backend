import { IsUUID } from 'class-validator';

export class AcceptFriendshipDto {
  @IsUUID()
  friendshipRequestId: string;
}
