import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    serviceAuth?: {
      clientId: string;
      subject: string;
      token: string;
    };
  }
}
