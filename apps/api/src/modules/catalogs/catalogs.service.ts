import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogItem, CatalogCategory } from '../../database/entities/catalog-item.entity';
import { CreateCatalogItemDto, UpdateCatalogItemDto } from './dto/catalog.dto';

@Injectable()
export class CatalogsService implements OnModuleInit {
  constructor(
    @InjectRepository(CatalogItem)
    private readonly catalogRepository: Repository<CatalogItem>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedInitialCatalogs();
  }

  async findAll(category?: CatalogCategory): Promise<CatalogItem[]> {
    const query = this.catalogRepository.createQueryBuilder('item');
    if (category) {
      query.where('item.category = :category', { category });
    }
    query.orderBy('item.category', 'ASC');
    query.addOrderBy('item.order_index', 'ASC');
    query.addOrderBy('item.name', 'ASC');
    return query.getMany();
  }

  async findOne(id: string): Promise<CatalogItem> {
    const item = await this.catalogRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Elemento de catálogo con ID ${id} no encontrado`);
    }
    return item;
  }

  async create(dto: CreateCatalogItemDto): Promise<CatalogItem> {
    const item = this.catalogRepository.create({
      category: dto.category,
      code: dto.code.trim().toUpperCase(),
      name: dto.name.trim(),
      description: dto.description?.trim() || '',
      order_index: dto.order_index ?? 0,
      is_active: true,
    });
    return this.catalogRepository.save(item);
  }

  async update(id: string, dto: UpdateCatalogItemDto): Promise<CatalogItem> {
    const item = await this.findOne(id);
    if (dto.code !== undefined) item.code = dto.code.trim().toUpperCase();
    if (dto.name !== undefined) item.name = dto.name.trim();
    if (dto.description !== undefined) item.description = dto.description.trim();
    if (dto.order_index !== undefined) item.order_index = dto.order_index;
    return this.catalogRepository.save(item);
  }

  async toggleStatus(id: string): Promise<CatalogItem> {
    const item = await this.findOne(id);
    item.is_active = !item.is_active;
    return this.catalogRepository.save(item);
  }

  private async seedInitialCatalogs(): Promise<void> {
    const count = await this.catalogRepository.count();
    if (count > 0) return;

    const initialData: Array<{
      category: CatalogCategory;
      code: string;
      name: string;
      description: string;
      order_index: number;
    }> = [
      // Cargos (Job Titles)
      { category: CatalogCategory.JOB_TITLE, code: 'CARG-01', name: 'Ingeniero de Software Senior', description: 'Desarrollo de software y arquitectura', order_index: 1 },
      { category: CatalogCategory.JOB_TITLE, code: 'CARG-02', name: 'Analista Contable y Financiero', description: 'Auditoría interna y conciliación', order_index: 2 },
      { category: CatalogCategory.JOB_TITLE, code: 'CARG-03', name: 'Gerente de Operaciones', description: 'Dirección logística y producción', order_index: 3 },
      { category: CatalogCategory.JOB_TITLE, code: 'CARG-04', name: 'Supervisor de Planta Industrial', description: 'Supervisión en turno de manufactura', order_index: 4 },
      { category: CatalogCategory.JOB_TITLE, code: 'CARG-05', name: 'Cajero / Operador POS', description: 'Atención a clientes y facturación', order_index: 5 },
      { category: CatalogCategory.JOB_TITLE, code: 'CARG-06', name: 'Asistente Administrativo', description: 'Soporte a recursos humanos y compras', order_index: 6 },
      { category: CatalogCategory.JOB_TITLE, code: 'CARG-07', name: 'Ejecutivo de Ventas Corporativas', description: 'Gestión comercial B2B', order_index: 7 },
      { category: CatalogCategory.JOB_TITLE, code: 'CARG-08', name: 'Especialista en Recursos Humanos', description: 'Talento humano y bienestar laboral', order_index: 8 },

      // Grados Salariales (Grade Levels)
      { category: CatalogCategory.GRADE_LEVEL, code: 'GRD-1', name: 'G-1 Operativo / Asistencial', description: 'Personal de apoyo operativo y administrativo inicial', order_index: 1 },
      { category: CatalogCategory.GRADE_LEVEL, code: 'GRD-2', name: 'G-2 Técnico / Analista Junior', description: 'Técnicos calificados y analistas con autonomía', order_index: 2 },
      { category: CatalogCategory.GRADE_LEVEL, code: 'GRD-3', name: 'G-3 Especialista / Senior', description: 'Profesionales especializados de alto impacto', order_index: 3 },
      { category: CatalogCategory.GRADE_LEVEL, code: 'GRD-4', name: 'G-4 Jefatura / Coordinación', description: 'Líderes de equipo y jefes de área', order_index: 4 },
      { category: CatalogCategory.GRADE_LEVEL, code: 'GRD-5', name: 'G-5 Gerencia Media', description: 'Gerencias de departamento y operaciones', order_index: 5 },
      { category: CatalogCategory.GRADE_LEVEL, code: 'GRD-6', name: 'G-6 Dirección Ejecutiva / C-Level', description: 'Dirección general y vicepresidencias', order_index: 6 },

      // Clasificaciones (Classifications)
      { category: CatalogCategory.CLASSIFICATION, code: 'CLS-PLANTA', name: 'PLANTA FIJA', description: 'Contrato por tiempo indeterminado de planta', order_index: 1 },
      { category: CatalogCategory.CLASSIFICATION, code: 'CLS-CONFIANZA', name: 'PERSONAL DE CONFIANZA', description: 'Cargos de confianza directiva o estratégica', order_index: 2 },
      { category: CatalogCategory.CLASSIFICATION, code: 'CLS-VIP', name: 'EJECUTIVO VIP', description: 'Clientes con línea de crédito premium', order_index: 3 },
      { category: CatalogCategory.CLASSIFICATION, code: 'CLS-TEMPORAL', name: 'TEMPORAL / PROYECTO', description: 'Contratos con vigencia limitada por proyecto', order_index: 4 },
    ];

    for (const item of initialData) {
      const entity = this.catalogRepository.create({
        ...item,
        is_active: true,
      });
      await this.catalogRepository.save(entity);
    }
  }
}
