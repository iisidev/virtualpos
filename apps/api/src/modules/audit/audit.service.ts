import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  async findAll(limit = 100): Promise<AuditLog[]> {
    return this.auditRepository.find({
      order: { created_at: 'DESC' },
      take: Math.min(200, limit),
    });
  }
}
