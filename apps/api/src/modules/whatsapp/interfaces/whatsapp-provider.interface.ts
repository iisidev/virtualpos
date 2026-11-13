import { VoucherDetails } from '../../credit/credit-ledger.service';

export interface WhatsAppProviderInterface {
  readonly providerName: string;

  sendMessage(to: string, message: string): Promise<boolean>;

  sendVoucher(to: string, voucher: VoucherDetails): Promise<boolean>;

  sendInteractiveMenu(to: string, clientName: string): Promise<boolean>;
}
