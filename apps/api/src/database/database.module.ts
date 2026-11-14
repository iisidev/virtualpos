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
  CatalogItem,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow<string>('DB_HOST'),
        port: Number(config.getOrThrow<string>('DB_PORT')),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_NAME'),
        entities: [
          Company,
          CashRegister,
          User,
          ClientCreditProfile,
          CreditTransaction,
          CreditIncreaseRequest,
          ImportBatchLog,
          AuditLog,
          CatalogItem,
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
      CatalogItem,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
