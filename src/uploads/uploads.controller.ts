import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
  Get,
  Param,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport'; // Usando AuthGuard direto para evitar bugs de import
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import express from 'express';
import * as fs from 'fs';

// Garante que a pasta de vídeos exista no servidor
const videoUploadDir = join(process.cwd(), 'uploads', 'videos');
if (!fs.existsSync(videoUploadDir)) {
  fs.mkdirSync(videoUploadDir, { recursive: true });
}

@Controller('uploads')
export class UploadsController {
  // UPLOAD DE IMAGEM (Base64) - Mantido igual
  @UseGuards(AuthGuard('jwt'))
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado');
    }

    const base64Image = file.buffer.toString('base64');
    const mimeType = file.mimetype || 'image/jpeg';
    const url = `data:${mimeType};base64,${base64Image}`;

    return { url };
  }

  // UPLOAD DE VÍDEO (Salvo no Servidor)
  @UseGuards(AuthGuard('jwt'))
  @Post('video')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: videoUploadDir,
        filename: (req, file, cb) => {
          // Cria um nome único para o vídeo (ex: video-16984...123.mp4)
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `video-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  uploadVideo(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('Nenhum vídeo foi enviado');
    }

    console.log('[UPLOAD] Vídeo salvo em disco:', file.filename);

    // Retorna a URL interna para acessar o vídeo depois
    return { url: `/uploads/video/${file.filename}` };
  }

  // ROTA PARA ACESSAR O VÍDEO NO APLICATIVO (Não precisa de AuthGuard para o Player conseguir ler direto)
  @Get('video/:filename')
  getVideo(@Param('filename') filename: string, @Res() res: express.Response) {
    const filePath = join(videoUploadDir, filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Vídeo não encontrado');
    }

    // Retorna o arquivo de vídeo como Stream para o Frontend
    return res.sendFile(filePath);
  }
}
