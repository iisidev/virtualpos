import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { AgentAccessMode } from '../../common/utils/classification.util';
import { AgentApiKeyGuard } from './agent-api-key.guard';
import {
  AgentBalanceResult,
  AgentCreateCreditRequestResult,
  AgentCreditRequestsResult,
  AgentMovementsResult,
  AgentService,
} from './agent.service';

export class LinkAgentPhoneDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  identifier!: string;
}

export class CreateAgentCreditRequestDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive({ message: 'El monto solicitado debe ser mayor a cero' })
  requested_limit!: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

/**
 * Real-time endpoints consumed by the OpenClaw WhatsApp agent (skill `corp-credit`).
 * Protected by x-agent-key instead of a user JWT and explicitly marked no-cache.
 */
@Public()
@UseGuards(AgentApiKeyGuard)
@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get('profile')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  getProfile(
    @Query('phone') phone: string,
    @Query('_t') _cacheBuster?: string,
  ): Promise<AgentBalanceResult> {
    return this.agentService.getBalance(phone);
  }

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

  @Get('credit-requests')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  getCreditRequests(
    @Query('phone') phone: string,
    @Query('limit') limitRaw?: string,
    @Query('_t') _cacheBuster?: string,
  ): Promise<AgentCreditRequestsResult> {
    const parsed = Number.parseInt(limitRaw ?? '5', 10);
    const limit = Number.isFinite(parsed) ? parsed : 5;
    return this.agentService.getCreditRequests(phone, limit);
  }

  @Post('credit-requests')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  createCreditRequest(
    @Body() body: CreateAgentCreditRequestDto,
  ): Promise<AgentCreateCreditRequestResult> {
    return this.agentService.createCreditRequest(
      body.phone,
      body.requested_limit,
      body.reason,
    );
  }

  @Post('link')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  link(
    @Body() body: LinkAgentPhoneDto,
  ): Promise<{
    linked: boolean;
    is_vip: boolean;
    agent_mode: AgentAccessMode;
    classification?: string;
    message: string;
    full_name?: string;
  }> {
    return this.agentService.linkPhone(body.phone, body.identifier);
  }
}
