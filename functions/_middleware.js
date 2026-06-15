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

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const scheme = getForwardedScheme(context.request) || url.protocol.replace(':', '');

  if (scheme === 'http') {
    url.protocol = 'https:';
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
}
