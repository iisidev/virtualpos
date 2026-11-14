import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from './whatsapp.service';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { extractPhoneDigits } from '../../common/utils/phone.util';

@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('config')
  getChannelConfig(): {
    bot_number: string | null;
    provider: string;
    openclaw_configured: boolean;
  } {
    const rawNumber = this.config.get<string>('WHATSAPP_BOT_NUMBER') || '';
    const digits = extractPhoneDigits(rawNumber);
    return {
      bot_number: digits.length >= 8 ? digits : null,
      provider: this.config.get<string>('WHATSAPP_PROVIDER') || 'openclaw',
      openclaw_configured: Boolean(this.config.get<string>('OPENCLAW_GATEWAY_URL')),
    };
  }

  /**
   * Meta Cloud API Webhook Verification Challenge
   */
  @Public()
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const verifyToken = this.config.getOrThrow<string>('WHATSAPP_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook de WhatsApp verificado exitosamente con Meta');
      return challenge;
    }
    throw new ForbiddenException('Verificación de webhook fallida: token incorrecto');
  }

  /**
   * Webhook message handler: compatible with both Meta Cloud API and OpenClaw payloads
   */
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleIncoming(
    @Body()
    body: {
      from?: string;
      message?: string;
      entry?: Array<{
        changes?: Array<{
          value?: {
            messages?: Array<{
              from?: string;
              text?: { body?: string };
            }>;
          };
        }>;
      }>;
    },
  ): Promise<{ status: string; reply?: string }> {
    let fromPhone = '';
    let messageText = '';

    // Check OpenClaw payload format: { from: "50588881234", message: "2" }
    if (body.from && body.message) {
      fromPhone = body.from;
      messageText = body.message;
    }
    // Check Meta Cloud API format
    else if (body.entry && body.entry[0]?.changes && body.entry[0].changes[0]?.value?.messages) {
      const msg = body.entry[0].changes[0].value.messages[0];
      if (msg && msg.from && msg.text?.body) {
        fromPhone = msg.from;
        messageText = msg.text.body;
      }
    }

    if (!fromPhone || !messageText) {
      return { status: 'IGNORED_NO_TEXT_MESSAGE' };
    }

    const reply = await this.whatsappService.handleIncomingMessage(fromPhone, messageText);
    return { status: 'SUCCESS', reply };
  }
}

