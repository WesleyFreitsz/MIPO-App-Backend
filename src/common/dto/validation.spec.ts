import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { UpdateProfileDto } from 'src/auth/dto/update-profile.dto';
import { SendMessageDto } from 'src/chats/dto/send-message.dto';
import { CreatePostDto } from 'src/posts/dto/create-post.dto';
import { PaginationQueryDto } from './pagination-query.dto';

const pipe = new ValidationPipe({ whitelist: true, transform: true });

const bodyOf = (metatype: ArgumentMetadata['metatype']): ArgumentMetadata => ({
  type: 'body',
  metatype,
});

describe('Validação global', () => {
  it('descarta role, coins e banned enviados no perfil', async () => {
    const result = (await pipe.transform(
      { name: 'Ana', role: 'ADMIN', coins: 9999, banned: false },
      bodyOf(UpdateProfileDto),
    )) as Record<string, unknown>;

    expect(result).toEqual({ name: 'Ana' });
  });

  it('descarta userId enviado ao criar post', async () => {
    const result = (await pipe.transform(
      { content: 'Olá', userId: 'outro-usuario' },
      bodyOf(CreatePostDto),
    )) as Record<string, unknown>;

    expect(result).toEqual({ content: 'Olá' });
  });

  it('descarta userId e mantém imageUrl na mensagem', async () => {
    const result = (await pipe.transform(
      {
        content: 'oi',
        imageUrl: 'https://cdn.mipo.com/a.png',
        userId: 'outro-usuario',
      },
      bodyOf(SendMessageDto),
    )) as Record<string, unknown>;

    expect(result).toEqual({
      content: 'oi',
      imageUrl: 'https://cdn.mipo.com/a.png',
    });
  });

  it('converte skip e take da query para número', async () => {
    const result = (await pipe.transform(
      { skip: '15', take: '15' },
      { type: 'query', metatype: PaginationQueryDto },
    )) as PaginationQueryDto;

    expect(result.skip + result.take).toBe(30);
  });

  it('recusa take acima do limite', async () => {
    await expect(
      pipe.transform(
        { take: '1000' },
        { type: 'query', metatype: PaginationQueryDto },
      ),
    ).rejects.toBeDefined();
  });
});
