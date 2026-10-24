import { AwsClient } from 'aws4fetch';

const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const FORWARDED_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
];

function isSafeKey(key) {
  return (
    key.length > 0 &&
    key.length <= 1024 &&
    !key.split('/').some((part) => part === '' || part === '.' || part === '..')
  );
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Método não permitido', {
        status: 405,
        headers: { Allow: 'GET, HEAD' },
      });
    }

    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    if (!isSafeKey(key)) {
      return new Response('Não encontrado', { status: 404 });
    }

    const isRangeRequest = request.headers.has('range');
    const cache = caches.default;
    const cacheKey = new Request(url.origin + url.pathname, { method: 'GET' });

    if (!isRangeRequest) {
      const cached = await cache.match(cacheKey);
      if (cached) {
        return request.method === 'HEAD'
          ? new Response(null, { status: cached.status, headers: cached.headers })
          : cached;
      }
    }

    const storage = new AwsClient({
      accessKeyId: env.B2_KEY_ID,
      secretAccessKey: env.B2_APPLICATION_KEY,
      service: 's3',
      region: env.B2_REGION,
    });

    const objectUrl = `${env.B2_ENDPOINT.replace(/\/+$/, '')}/${env.B2_BUCKET}/${key
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;

    const upstreamHeaders = new Headers();
    if (isRangeRequest) upstreamHeaders.set('range', request.headers.get('range'));

    const upstream = await storage.fetch(objectUrl, {
      method: request.method,
      headers: upstreamHeaders,
    });

    if (upstream.status === 404 || upstream.status === 403) {
      return new Response('Não encontrado', { status: 404 });
    }
    if (!upstream.ok && upstream.status !== 206) {
      return new Response('Falha ao buscar o arquivo', { status: 502 });
    }

    const headers = new Headers();
    for (const name of FORWARDED_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set('cache-control', CACHE_CONTROL);
    headers.set('x-content-type-options', 'nosniff');

    const response = new Response(upstream.body, {
      status: upstream.status,
      headers,
    });

    if (request.method === 'GET' && upstream.status === 200) {
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }
    return response;
  },
};
