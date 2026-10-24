import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { Upload } from './entities/upload.entity';

const BUCKET_NAME = 'mipo-bucket';

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const VIDEO_EXTENSIONS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/mov': 'mov',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
  'video/3gp': '3gp',
  'video/x-m4v': 'm4v',
  'video/m4v': 'm4v',
};

export type UploadKind = 'image' | 'video' | 'media';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly supabase: ReturnType<typeof createClient>;

  constructor(
    @InjectRepository(Upload)
    private readonly uploadRepository: Repository<Upload>,
    configService: ConfigService,
  ) {
    this.supabase = createClient(
      configService.getOrThrow<string>('SUPABASE_URL'),
      configService.getOrThrow<string>('SUPABASE_KEY'),
    );
  }

  async upload(
    file: Express.Multer.File | undefined,
    kind: UploadKind,
    folderFor: (isVideo: boolean) => string,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo foi enviado');

    const mimetype = file.mimetype.toLowerCase();
    const imageExtension = IMAGE_EXTENSIONS[mimetype];
    const videoExtension = VIDEO_EXTENSIONS[mimetype];
    const isVideo = Boolean(videoExtension);

    const allowed =
      (kind === 'image' && imageExtension) ||
      (kind === 'video' && videoExtension) ||
      (kind === 'media' && (imageExtension || videoExtension));
    if (!allowed) {
      throw new BadRequestException('Tipo de arquivo não permitido');
    }

    const maxSize = isVideo ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES;
    if (file.size > maxSize) {
      throw new PayloadTooLargeException('Arquivo maior que o permitido');
    }

    // 1. Gera a Impressão Digital (Hash SHA-256) do arquivo
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');

    // 2. Procura no banco se esse arquivo já existe
    const existingUpload = await this.uploadRepository.findOne({
      where: { hash: fileHash },
    });
    if (existingUpload) {
      return { url: existingUpload.url };
    }

    const extension = imageExtension || videoExtension;
    const fileName = `${folderFor(isVideo)}/${Date.now()}-${fileHash.substring(0, 10)}.${extension}`;

    const { error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file.buffer, {
        contentType: mimetype,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Erro no upload para o storage: ${error.message}`);
      throw new InternalServerErrorException(
        'Não foi possível enviar o arquivo.',
      );
    }

    const {
      data: { publicUrl },
    } = this.supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);

    // 4. Salva a nova URL e o Hash na base de dados para futuras deduplicações
    await this.uploadRepository.save(
      this.uploadRepository.create({ hash: fileHash, url: publicUrl }),
    );

    return { url: publicUrl };
  }
}
