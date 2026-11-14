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
  IsBoolean,
  IsIn,
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
  VipBroadcastResult,
  VipClientLookupResult,
  VipClientsSummaryResult,
  VipSalesReportResult,
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

export class VipBroadcastDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsOptional()
  @IsIn(['draft', 'confirm', 'cancel', 'status'])
  action?: 'draft' | 'confirm' | 'cancel' | 'status';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsString()
  draft_id?: string;

  @IsOptional()
  @IsBoolean()
  approve?: boolean;

  @IsOptional()
  @IsString()
  job_id?: string;

  @IsOptional()
  @IsString()
  employer_company_id?: string;
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

  /** VIP-only #1: Real-time client counts by company, classification type, and credit status. */
  @Get('vip/clients/summary')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  getVipClientsSummary(
    @Query('phone') phone: string,
    @Query('company') company?: string,
    @Query('_t') _cacheBuster?: string,
  ): Promise<VipClientsSummaryResult> {
    return this.agentService.getVipClientsSummary(phone, company);
  }

  /** VIP-only #2: Registered client lookup (name, surname, credit availability, profile). */
  @Get('vip/clients/lookup')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  lookupVipClients(
    @Query('phone') phone: string,
    @Query('q') q?: string,
    @Query('query') queryAlias?: string,
    @Query('limit') limitRaw?: string,
    @Query('_t') _cacheBuster?: string,
  ): Promise<VipClientLookupResult> {
    const parsed = Number.parseInt(limitRaw ?? '10', 10);
    const limit = Number.isFinite(parsed) ? parsed : 10;
    return this.agentService.lookupVipClients(phone, q ?? queryAlias ?? '', limit);
  }

  /** VIP-only #3: Daily or period sales report grouped by total or by company. */
  @Get('vip/sales/report')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  getVipSalesReport(
    @Query('phone') phone: string,
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('group_by') groupBy?: string,
    @Query('company') company?: string,
    @Query('_t') _cacheBuster?: string,
  ): Promise<VipSalesReportResult> {
    return this.agentService.getVipSalesReport(phone, {
      period,
      from,
      to,
      groupBy,
      company,
    });
  }

  /** VIP-only #4: Mass WhatsApp notification with mandatory draft preview and VIP approval. */
  @Post('vip/broadcast')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  handleVipBroadcast(@Body() body: VipBroadcastDto): Promise<VipBroadcastResult> {
    return this.agentService.handleVipBroadcast(body.phone, body);
  }
}
