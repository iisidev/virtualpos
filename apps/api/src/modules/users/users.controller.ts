import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { UsersService, UserResponse } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CREDIT_MANAGER)
  async findAll(): Promise<UserResponse[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CREDIT_MANAGER)
  async findOne(@Param('id') id: string): Promise<UserResponse> {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponse> {
    return this.usersService.create(dto, user.username);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponse> {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN)
  async toggleStatus(@Param('id') id: string): Promise<UserResponse> {
    return this.usersService.toggleStatus(id);
  }
}
