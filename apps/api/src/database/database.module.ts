import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  Company,
  CashRegister,
  User,
  ClientCreditProfile,
  CreditTransaction,
  CreditIncreaseRequest,
  ImportBatchLog,
  AuditLog,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get<number>('DB_PORT', 5432)),
        username: config.get<string>('DB_USER', 'pos_admin'),
        password: config.get<string>('DB_PASSWORD', 'pos_secure_pass_2026'),
        database: config.get<string>('DB_NAME', 'corp_credit_pos'),
        entities: [
          Company,
          CashRegister,
          User,
          ClientCreditProfile,
          CreditTransaction,
          CreditIncreaseRequest,
          ImportBatchLog,
          AuditLog,
        ],
        synchronize: config.get<string>('DB_SYNCHRONIZE', 'true') === 'true',
        logging: config.get<string>('DB_LOGGING', 'false') === 'true',
      }),
    }),
    TypeOrmModule.forFeature([
      Company,
      CashRegister,
      User,
      ClientCreditProfile,
      CreditTransaction,
      CreditIncreaseRequest,
      ImportBatchLog,
      AuditLog,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

