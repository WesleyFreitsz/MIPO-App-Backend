import { IsBoolean, IsUUID } from 'class-validator';
import { SendMessageDto } from './send-message.dto';

export class ChatRoomDto {
  @IsUUID()
  chatId: string;
}

export class SocketSendMessageDto extends SendMessageDto {
  @IsUUID()
  chatId: string;
}

export class SocketTypingDto {
  @IsUUID()
  chatId: string;

  @IsBoolean()
  isTyping: boolean;
}

export class SocketWatchPresenceDto {
  @IsUUID()
  userId: string;
}
