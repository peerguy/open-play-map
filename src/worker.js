import {
  onRequestPost as postLocationToInstagram,
  onRequestPreflightImages as preflightInstagramImages,
  onRequestSearchLocations as searchInstagramLocations
} from '../functions/api/instagram/post-location.js';

function getForwardedScheme(request) {
  const cfVisitor = request.headers.get('cf-visitor');

  if (cfVisitor) {
    try {
      return JSON.parse(cfVisitor).scheme;
    } catch {
      return null;
    }
  }

  return request.headers.get('x-forwarded-proto');
}

function redirectHttp(request) {
  const url = new URL(request.url);
  const scheme = getForwardedScheme(request) || url.protocol.replace(':', '');
  if (scheme !== 'http') return null;

  url.protocol = 'https:';
  return Response.redirect(url.toString(), 301);
}

export default {
  async fetch(request, env, ctx) {
    const redirect = redirectHttp(request);
    if (redirect) return redirect;

    const url = new URL(request.url);
    if (url.pathname === '/api/instagram/post-location' && request.method === 'POST') {
      return postLocationToInstagram({ request, env, ctx });
    }
    if (url.pathname === '/api/instagram/preflight-images' && request.method === 'POST') {
      return preflightInstagramImages({ request, env, ctx });
    }
    if (url.pathname === '/api/instagram/search-locations' && request.method === 'POST') {
      return searchInstagramLocations({ request, env, ctx });
    }

    if (url.pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 });
    }

    return env.ASSETS.fetch(request);
  }
};
