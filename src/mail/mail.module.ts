import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Module({
  providers: [MailService],
  exports: [MailService], // Exportamos para que o AuthModule possa usar
})
export class MailModule {}
