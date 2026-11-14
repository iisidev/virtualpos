import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

/**
 * Service-to-service guard for the OpenClaw agent.
 * Requires header `x-agent-key` equal to the AGENT_API_KEY env variable.
 */
@Injectable()
export class AgentApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('AGENT_API_KEY');
    if (!expected) {
      throw new UnauthorizedException('AGENT_API_KEY no está configurada en el servidor');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers['x-agent-key'];
    const provided = Array.isArray(header) ? header[0] : header;
    if (!provided) {
      throw new UnauthorizedException('Falta la cabecera x-agent-key');
    }

    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Clave de agente inválida');
    }
    return true;
  }
}

