import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelFinanceConfigController } from './controllers/hotel-finance-config.controller';
import { HotelFinanceConfigService } from './services/hotel-finance-config.service';
import { Hotel } from '../../database/entities/hotel.entity';
import { TaxRule } from '../../database/entities/tax-rule.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Hotel, TaxRule])],
  controllers: [HotelFinanceConfigController],
  providers: [HotelFinanceConfigService],
  exports: [HotelFinanceConfigService],
})
export class HotelFinanceConfigModule {}
