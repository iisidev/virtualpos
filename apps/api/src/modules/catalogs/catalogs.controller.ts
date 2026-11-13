import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CatalogsService } from './catalogs.service';
import { CreateCatalogItemDto, UpdateCatalogItemDto } from './dto/catalog.dto';
import { CatalogCategory, CatalogItem } from '../../database/entities/catalog-item.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@Controller('catalogs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CREDIT_MANAGER, UserRole.CASHIER, UserRole.AUDITOR)
  async findAll(@Query('category') category?: CatalogCategory): Promise<CatalogItem[]> {
    return this.catalogsService.findAll(category);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CREDIT_MANAGER, UserRole.CASHIER, UserRole.AUDITOR)
  async findOne(@Param('id') id: string): Promise<CatalogItem> {
    return this.catalogsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CREDIT_MANAGER)
  async create(@Body() dto: CreateCatalogItemDto): Promise<CatalogItem> {
    return this.catalogsService.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CREDIT_MANAGER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogItemDto,
  ): Promise<CatalogItem> {
    return this.catalogsService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CREDIT_MANAGER)
  async toggleStatus(@Param('id') id: string): Promise<CatalogItem> {
    return this.catalogsService.toggleStatus(id);
  }
}
