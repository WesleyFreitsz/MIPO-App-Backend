import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'mipo-bucket';

@Controller('uploads')
export class UploadsController {
  private supabase: SupabaseClient;

  constructor() {
    // 🚀 Inicializa DENTRO do construtor para garantir que o .env já foi carregado!
    this.supabase = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_KEY as string,
    );
  }

  /**
   * UPLOAD DE AVATAR / IMAGENS
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado');
    }

    const fileName = `avatars/${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;

    // Usando this.supabase
    const { error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      throw new BadRequestException(`Erro no upload: ${error.message}`);
    }

    const {
      data: { publicUrl },
    } = this.supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);

    return { url: publicUrl };
  }

  /**
   * UPLOAD DE CONTEÚDO DE CHAT (VÍDEOS E IMAGENS)
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('chat-content')
  @UseInterceptors(FileInterceptor('file'))
  async uploadChatContent(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado');
    }

    const isVideo = file.mimetype.includes('video');
    const folder = isVideo ? 'videos' : 'chat-images';
    const fileName = `${folder}/${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;

    // Usando this.supabase
    const { error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      throw new BadRequestException(`Erro no upload: ${error.message}`);
    }

    const {
      data: { publicUrl },
    } = this.supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);

    return { url: publicUrl };
  }

  /**
   * Rota antiga "video" mantida para compatibilidade
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('video')
  @UseInterceptors(FileInterceptor('file'))
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    return this.uploadChatContent(file);
  }
}
