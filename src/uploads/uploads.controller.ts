import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  UploadsService,
} from './uploads.service';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_SIZE_BYTES } }),
  )
  async uploadAvatar(@UploadedFile() file?: Express.Multer.File) {
    return this.uploadsService.upload(file, 'image', () => 'avatars');
  }

  @Post('chat-content')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_VIDEO_SIZE_BYTES } }),
  )
  async uploadChatContent(@UploadedFile() file?: Express.Multer.File) {
    return this.uploadsService.upload(file, 'media', (isVideo) =>
      isVideo ? 'videos' : 'chat-images',
    );
  }

  @Post('video')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_VIDEO_SIZE_BYTES } }),
  )
  async uploadVideo(@UploadedFile() file?: Express.Multer.File) {
    return this.uploadsService.upload(file, 'video', () => 'videos');
  }
}
