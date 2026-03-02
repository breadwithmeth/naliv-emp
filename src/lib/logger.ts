import pino from 'pino';
import { env } from '../config/env';

const loggerOptions = env.NODE_ENV === 'production'
  ? {
    level: env.LOG_LEVEL
  }
  : {
    level: env.LOG_LEVEL,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard'
      }
    }
  };

export const logger = pino(loggerOptions);
