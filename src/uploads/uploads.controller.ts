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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Upload } from './entities/upload.entity';

const BUCKET_NAME = 'mipo-bucket';

@Controller('uploads')
export class UploadsController {
  private supabase: SupabaseClient;

  constructor(
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_KEY as string,
    );
  }

  /**
   * Função centralizada com LÓGICA DE DEDUPLICAÇÃO
   */
  private async processAndUpload(file: Express.Multer.File, folder: string) {
    if (!file) throw new BadRequestException('Nenhum arquivo foi enviado');

    // 1. Gera a Impressão Digital (Hash SHA-256) do arquivo
    const fileHash = crypto
      .createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    // 2. Procura no banco se esse arquivo já existe
    const existingUpload = await this.uploadRepository.findOne({
      where: { hash: fileHash },
    });

    if (existingUpload) {
      console.log(
        `♻️ Arquivo duplicado detectado! Usando link existente: ${existingUpload.url}`,
      );
      // Pula todo o processo de upload no Supabase e devolve a URL já pronta!
      return { url: existingUpload.url };
    }

    // 3. Se não existir, faz o upload físico para o Supabase
    const ext = file.originalname.split('.').pop();
    // Usa um pedaço do hash no nome do arquivo para garantir nomes únicos e limpos
    const fileName = `${folder}/${Date.now()}-${fileHash.substring(0, 10)}.${ext}`;

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

    // 4. Salva a nova URL e o Hash na base de dados para futuras deduplicações
    const newRecord = this.uploadRepository.create({
      hash: fileHash,
      url: publicUrl,
    });
    await this.uploadRepository.save(newRecord);

    console.log(`✅ Novo arquivo salvo: ${publicUrl}`);
    return { url: publicUrl };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    return this.processAndUpload(file, 'avatars');
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('chat-content')
  @UseInterceptors(FileInterceptor('file'))
  async uploadChatContent(@UploadedFile() file: Express.Multer.File) {
    const isVideo = file.mimetype.includes('video');
    const folder = isVideo ? 'videos' : 'chat-images';
    return this.processAndUpload(file, folder);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('video')
  @UseInterceptors(FileInterceptor('file'))
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    return this.processAndUpload(file, 'videos');
  }
}
