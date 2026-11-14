import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { AgentApiKeyGuard } from './agent-api-key.guard';
import {
  AgentBalanceResult,
  AgentMovementsResult,
  AgentService,
} from './agent.service';

/**
 * Real-time endpoints consumed by the OpenClaw WhatsApp agent (skill `corp-credit`).
 * Protected by x-agent-key instead of a user JWT and explicitly marked no-cache.
 */
@Public()
@UseGuards(AgentApiKeyGuard)
@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get('balance')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  getBalance(
    @Query('phone') phone: string,
    @Query('_t') _cacheBuster?: string,
  ): Promise<AgentBalanceResult> {
    return this.agentService.getBalance(phone);
  }

  @Get('movements')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  getMovements(
    @Query('phone') phone: string,
    @Query('limit') limitRaw?: string,
    @Query('_t') _cacheBuster?: string,
  ): Promise<AgentMovementsResult> {
    const parsed = Number.parseInt(limitRaw ?? '5', 10);
    const limit = Number.isFinite(parsed) ? parsed : 5;
    return this.agentService.getMovements(phone, limit);
  }

  @Post('link')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  link(
    @Body() body: { phone: string; identifier: string },
  ): Promise<{ linked: boolean; message: string; full_name?: string }> {
    return this.agentService.linkPhone(body.phone, body.identifier);
  }
}
