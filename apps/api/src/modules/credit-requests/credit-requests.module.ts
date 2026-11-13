import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditIncreaseRequest } from '../../database/entities/credit-increase-request.entity';
import { ClientCreditProfile } from '../../database/entities/client-credit-profile.entity';
import { CreditRequestsService } from './credit-requests.service';
import { CreditRequestsController } from './credit-requests.controller';
import { CreditModule } from '../credit/credit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CreditIncreaseRequest, ClientCreditProfile]),
    CreditModule,
  ],
  controllers: [CreditRequestsController],
  providers: [CreditRequestsService],
  exports: [CreditRequestsService],
})
export class CreditRequestsModule {}

