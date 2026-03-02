import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';

export function registerErrorHandler(app: { setErrorHandler: (handler: (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => void) => void }): void {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    request.log.error({ err: error }, 'Unhandled error');

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: error.issues
      });
    }

    if (error.validation) {
      return reply.status(400).send({
        error: 'REQUEST_VALIDATION_ERROR',
        message: error.message
      });
    }

    return reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error'
    });
  });
}
