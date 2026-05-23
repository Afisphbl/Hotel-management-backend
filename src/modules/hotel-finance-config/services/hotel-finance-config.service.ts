import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hotel } from '../../../database/entities/hotel.entity';
import { UpdateHotelFinanceConfigDto } from '../dto/hotel-finance-config.dto';
import { TaxRule } from '../../../database/entities/tax-rule.entity';

@Injectable()
export class HotelFinanceConfigService {
  constructor(
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    @InjectRepository(TaxRule)
    private taxRuleRepository: Repository<TaxRule>,
  ) {}

  async getConfig(hotelId: string) {
    const hotel = await this.hotelRepository.findOne({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException('Hotel not found');

    const taxes = await this.taxRuleRepository.find();

    return {
      bankAccounts: hotel.settings?.finance?.bankAccounts || [],
      gateways: hotel.settings?.finance?.gateways || {
        chapa: { enabled: false },
        stripe: { enabled: false },
        paypal: { enabled: false },
      },
      acceptedPaymentMethods: hotel.paymentMethods || ['CASH'],
      invoiceSettings: hotel.settings?.finance?.invoiceSettings || {
        prefix: 'INV-',
        nextNumber: '1000',
        showTaxBreakdown: true,
      },
      taxes,
    };
  }

  async updateConfig(hotelId: string, dto: UpdateHotelFinanceConfigDto) {
    const hotel = await this.hotelRepository.findOne({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException('Hotel not found');

    if (!hotel.settings) hotel.settings = {};
    if (!hotel.settings.finance) hotel.settings.finance = {};

    if (dto.bankAccounts) {
      hotel.settings.finance.bankAccounts = dto.bankAccounts;
    }

    if (dto.gateways) {
      hotel.settings.finance.gateways = {
        ...(hotel.settings.finance.gateways || {}),
        ...dto.gateways,
      };
    }

    if (dto.invoiceSettings) {
      hotel.settings.finance.invoiceSettings = {
        ...(hotel.settings.finance.invoiceSettings || {}),
        ...dto.invoiceSettings,
      };
    }

    if (dto.acceptedPaymentMethods) {
      hotel.paymentMethods = dto.acceptedPaymentMethods;
    }

    await this.hotelRepository.save(hotel);
    return this.getConfig(hotelId);
  }

  // Tax management helpers
  async addTaxRule(dto: any) {
    const rule = this.taxRuleRepository.create(dto);
    return this.taxRuleRepository.save(rule);
  }

  async updateTaxRule(id: string, dto: any) {
    const rule = await this.taxRuleRepository.findOneBy({ id });
    if (!rule) throw new NotFoundException('Tax rule not found');
    Object.assign(rule, dto);
    return this.taxRuleRepository.save(rule);
  }

  async removeTaxRule(id: string) {
    const rule = await this.taxRuleRepository.findOneBy({ id });
    if (!rule) throw new NotFoundException('Tax rule not found');
    return this.taxRuleRepository.remove(rule);
  }
}
