import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ClientCreditProfile,
  CreditIncreaseRequest,
  CreditTransaction,
} from '../../database/entities';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentApiKeyGuard } from './agent-api-key.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClientCreditProfile,
      CreditTransaction,
      CreditIncreaseRequest,
    ]),
  ],
  controllers: [AgentController],
  providers: [AgentService, AgentApiKeyGuard],
})
export class AgentModule {}
