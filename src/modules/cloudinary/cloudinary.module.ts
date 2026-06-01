import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { CloudinaryController } from './cloudinary.controller';
import { TenantQuotaService } from '../../common/services/tenant-quota.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hotel } from '../../database/entities/hotel.entity';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [TypeOrmModule.forFeature([Hotel]), DatabaseModule],
  controllers: [CloudinaryController],
  providers: [CloudinaryService, TenantQuotaService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
