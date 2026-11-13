import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogItem } from '../../database/entities/catalog-item.entity';
import { CatalogsService } from './catalogs.service';
import { CatalogsController } from './catalogs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CatalogItem])],
  controllers: [CatalogsController],
  providers: [CatalogsService],
  exports: [CatalogsService],
})
export class CatalogsModule {}
