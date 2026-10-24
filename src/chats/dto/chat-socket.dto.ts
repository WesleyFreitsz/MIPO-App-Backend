import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { SendMessageDto } from './send-message.dto';

export class ChatRoomDto {
  @IsUUID()
  chatId: string;
}

export class SocketSendMessageDto extends SendMessageDto {
  @IsUUID()
  chatId: string;
}

export class SocketEditMessageDto {
  @IsUUID()
  messageId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  newText: string;
}

export class SocketDeleteMessageDto {
  @IsUUID()
  messageId: string;
}
