import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { Upload } from './entities/upload.entity';
import { ObjectStorageService } from './object-storage.service';

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

const CANONICAL_CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
  m4v: 'video/x-m4v',
};

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

  constructor(
    @InjectRepository(Upload)
    private readonly uploadRepository: Repository<Upload>,
    private readonly objectStorage: ObjectStorageService,
  ) {}

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

    let publicUrl: string;
    try {
      publicUrl = await this.objectStorage.putObject(
        fileName,
        file.buffer,
        CANONICAL_CONTENT_TYPES[extension],
      );
    } catch (error) {
      this.logger.error(
        `Erro no upload para o storage: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new InternalServerErrorException(
        'Não foi possível enviar o arquivo.',
      );
    }

    // 4. Salva a nova URL e o Hash na base de dados para futuras deduplicações
    await this.uploadRepository.save(
      this.uploadRepository.create({ hash: fileHash, url: publicUrl }),
    );

    return { url: publicUrl };
  }
}
