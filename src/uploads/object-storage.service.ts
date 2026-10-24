import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

@Injectable()
export class ObjectStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(configService: ConfigService) {
    this.bucket = configService.getOrThrow<string>('STORAGE_BUCKET');
    this.publicBaseUrl = configService
      .getOrThrow<string>('STORAGE_PUBLIC_URL')
      .replace(/\/+$/, '');
    this.client = new S3Client({
      endpoint: configService.getOrThrow<string>('STORAGE_ENDPOINT'),
      region: configService.getOrThrow<string>('STORAGE_REGION'),
      credentials: {
        accessKeyId: configService.getOrThrow<string>('STORAGE_ACCESS_KEY_ID'),
        secretAccessKey: configService.getOrThrow<string>(
          'STORAGE_SECRET_ACCESS_KEY',
        ),
      },
      forcePathStyle:
        configService.get<string>('STORAGE_FORCE_PATH_STYLE') === 'true',
    });
  }

  async putObject(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
      }),
    );
    return `${this.publicBaseUrl}/${key}`;
  }
}
