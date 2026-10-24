import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as express from 'express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { json, urlencoded } from 'express';
import { RoomsSeed } from './rooms/rooms.seed';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

function parseAllowedOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  app.set('trust proxy', 1);

  const allowedOrigins = parseAllowedOrigins();
  // Habilitar CORS globalmente
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(
    new AllExceptionsFilter(app.get(HttpAdapterHost).httpAdapter),
  );

  // Usar process.cwd() para pegar a raiz do projeto
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }

  // Servir arquivos estáticos em /uploads com tipos MIME corretos
  app.use(
    '/uploads',
    express.static(uploadsDir, {
      setHeaders: (res) => {
        res.set('Cache-Control', 'public, max-age=3600');
        res.set('X-Content-Type-Options', 'nosniff');
      },
    }),
  );

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // Inicializar as salas fixas
  try {
    const roomsSeed = app.get(RoomsSeed);
    await roomsSeed.seed();
    logger.log('Salas fixas inicializadas');
  } catch (error) {
    logger.warn(
      `Erro ao inicializar salas: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Servidor rodando na porta ${port}`);
}
void bootstrap();
