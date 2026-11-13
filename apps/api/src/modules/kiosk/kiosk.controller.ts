import { Controller, Get, Param } from '@nestjs/common';
import { KioskService, KioskDisplayData } from './kiosk.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('kiosk')
export class KioskController {
  constructor(private readonly kioskService: KioskService) {}

  @Public()
  @Get('query/:query')
  async getProfile(@Param('query') query: string): Promise<KioskDisplayData> {
    return this.kioskService.getKioskProfile(query);
  }
}
