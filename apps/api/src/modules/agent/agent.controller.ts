import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  DefaultValuePipe,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { AgentApiKeyGuard } from './agent-api-key.guard';
import { AgentService, AgentBalanceResult, AgentMovement } from './agent.service';

/**
 * Endpoints consumed by the OpenClaw WhatsApp agent (skill `corp-credit`).
 * Protected by x-agent-key instead of a user JWT.
 */
@Public()
@UseGuards(AgentApiKeyGuard)
@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get('balance')
  getBalance(@Query('phone') phone: string): Promise<AgentBalanceResult> {
    return this.agentService.getBalance(phone);
  }

  @Get('movements')
  getMovements(
    @Query('phone') phone: string,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ): Promise<{ linked: boolean; movements: AgentMovement[] }> {
    return this.agentService.getMovements(phone, limit);
  }

  @Post('link')
  link(
    @Body() body: { phone: string; identifier: string },
  ): Promise<{ linked: boolean; message: string; full_name?: string }> {
    return this.agentService.linkPhone(body.phone, body.identifier);
  }
}
