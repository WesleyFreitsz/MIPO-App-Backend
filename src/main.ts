import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { json, urlencoded } from 'express';
import { RoomsSeed } from './rooms/rooms.seed';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS globalmente
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  // Usar process.cwd() para pegar a raiz do projeto
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
    console.log(`[UPLOADS] Diretório criado: ${uploadsDir}`);
  } else {
    console.log(`[UPLOADS] Diretório já existe: ${uploadsDir}`);
  }

  // Servir arquivos estáticos em /uploads com tipos MIME corretos
  app.use(
    '/uploads',
    express.static(uploadsDir, {
      setHeaders: (res, path) => {
        res.set('Cache-Control', 'public, max-age=3600');
        res.set('Access-Control-Allow-Origin', '*');
      },
    }),
  );

  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  console.log(`[SERVER] Servindo uploads em: /uploads`);

  // Inicializar as salas fixas
  try {
    const roomsSeed = app.get(RoomsSeed);
    await roomsSeed.seed();
    console.log('[ROOMS] Salas fixas inicializadas!');
  } catch (error) {
    console.warn('[ROOMS] Erro ao inicializar salas:', error.message);
  }

  await app.listen(process.env.PORT ?? 3000, () => {
    console.log(
      `[SERVER] Servidor rodando na porta ${process.env.PORT ?? 3000}`,
    );
  });
}
bootstrap();
