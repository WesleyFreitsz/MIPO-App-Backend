import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendRecoveryCode(to: string, name: string, code: string) {
    await this.mailerService.sendMail({
      to,
      subject: 'Recuperação de Senha - Mipo',
      template: './recovery', // Nome do arquivo .hbs
      context: {
        name, // Variáveis que o template vai usar
        code,
      },
    });
  }
}
