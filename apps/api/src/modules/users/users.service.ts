import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities/user.entity';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

export interface UserResponse {
  id: string;
  username: string;
  full_name: string;
  role: string;
  company_id?: string | null;
  company_name?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<UserResponse[]> {
    const users = await this.userRepository.find({
      order: { created_at: 'DESC' },
      relations: { company: true },
    });
    return users.map((u) => this.mapToResponse(u));
  }

  async findOne(id: string): Promise<UserResponse> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { company: true },
    });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    return this.mapToResponse(user);
  }

  async create(dto: CreateUserDto, createdBy?: string): Promise<UserResponse> {
    const existing = await this.userRepository.findOne({
      where: { username: dto.username.trim() },
    });
    if (existing) {
      throw new ConflictException(`El usuario '${dto.username}' ya existe`);
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(dto.password, salt);

    const user = this.userRepository.create({
      username: dto.username.trim(),
      password_hash,
      full_name: dto.full_name.trim(),
      role: dto.role,
      company_id: dto.company_id || null,
      is_active: dto.is_active !== undefined ? dto.is_active : true,
      created_by: createdBy || 'ADMIN',
    });

    const saved = await this.userRepository.save(user);
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponse> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    if (dto.username && dto.username.trim() !== user.username) {
      const existing = await this.userRepository.findOne({
        where: { username: dto.username.trim() },
      });
      if (existing) {
        throw new ConflictException(`El nombre de usuario '${dto.username}' ya está en uso`);
      }
      user.username = dto.username.trim();
    }

    if (dto.password && dto.password.trim().length > 0) {
      const salt = await bcrypt.genSalt(10);
      user.password_hash = await bcrypt.hash(dto.password, salt);
    }

    if (dto.full_name !== undefined) user.full_name = dto.full_name.trim();
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.company_id !== undefined) user.company_id = dto.company_id || null;
    if (dto.is_active !== undefined) user.is_active = dto.is_active;

    await this.userRepository.save(user);
    return this.findOne(id);
  }

  async toggleStatus(id: string): Promise<UserResponse> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    user.is_active = !user.is_active;
    await this.userRepository.save(user);
    return this.findOne(id);
  }

  private mapToResponse(user: User): UserResponse {
    return {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      company_id: user.company_id,
      company_name: user.company?.name || null,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
      created_by: user.created_by,
    };
  }
}
