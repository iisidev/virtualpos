import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashRegister } from '../../database/entities/cash-register.entity';
import { Company } from '../../database/entities/company.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { CashRegistersService } from './cash-registers.service';
import { CashRegistersController } from './cash-registers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CashRegister, Company, AuditLog])],
  controllers: [CashRegistersController],
  providers: [CashRegistersService],
  exports: [CashRegistersService],
})
export class CashRegistersModule {}

