import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Hotel } from '../../../database/entities/hotel.entity';
import { UpdateHotelFinanceConfigDto } from '../dto/hotel-finance-config.dto';

@Injectable()
export class HotelFinanceConfigService {
  constructor(
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    private dataSource: DataSource,
  ) {}

  private async getSchema(hotelId: string): Promise<string> {
    const hotel = await this.hotelRepository.findOne({
      where: { id: hotelId },
    });
    if (!hotel?.schemaName)
      throw new NotFoundException('Hotel schema not found');
    return hotel.schemaName.replace(/[^a-zA-Z0-9_]/g, '');
  }

  async getConfig(hotelId: string) {
    const hotel = await this.hotelRepository.findOne({
      where: { id: hotelId },
    });
    if (!hotel) throw new NotFoundException('Hotel not found');

    const s = await this.getSchema(hotelId);
    const taxes = await this.dataSource.query(
      `SELECT * FROM "${s}"."tax_rules" WHERE "deletedAt" IS NULL`,
    );

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
    const hotel = await this.hotelRepository.findOne({
      where: { id: hotelId },
    });
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
  async addTaxRule(hotelId: string, dto: any) {
    const s = await this.getSchema(hotelId);
    const rows = await this.dataSource.query(
      `INSERT INTO "${s}"."tax_rules" (name, type, rate, application, "isActive", "validFrom", "validTo", description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        dto.name,
        dto.type,
        dto.rate,
        dto.application ?? 'percentage',
        dto.isActive ?? true,
        dto.validFrom ?? null,
        dto.validTo ?? null,
        dto.description ?? null,
      ],
    );
    return rows[0];
  }

  async updateTaxRule(hotelId: string, id: string, dto: any) {
    const s = await this.getSchema(hotelId);
    const allowed = [
      'name',
      'type',
      'rate',
      'application',
      'isActive',
      'validFrom',
      'validTo',
      'description',
    ];
    const fields: string[] = [];
    const params: any[] = [];
    for (const key of allowed) {
      if (dto[key] !== undefined) {
        params.push(dto[key]);
        fields.push(`"${key}" = $${params.length}`);
      }
    }
    if (!fields.length) {
      const rows = await this.dataSource.query(
        `SELECT * FROM "${s}"."tax_rules" WHERE id = $1 AND "deletedAt" IS NULL`,
        [id],
      );
      if (!rows.length) throw new NotFoundException('Tax rule not found');
      return rows[0];
    }
    params.push(id);
    const rows = await this.dataSource.query(
      `UPDATE "${s}"."tax_rules" SET ${fields.join(', ')}, "updatedAt" = NOW() WHERE id = $${params.length} AND "deletedAt" IS NULL RETURNING *`,
      params,
    );
    if (!rows.length) throw new NotFoundException('Tax rule not found');
    return rows[0];
  }

  async removeTaxRule(hotelId: string, id: string) {
    const s = await this.getSchema(hotelId);
    const rows = await this.dataSource.query(
      `UPDATE "${s}"."tax_rules" SET "deletedAt" = NOW() WHERE id = $1 AND "deletedAt" IS NULL RETURNING *`,
      [id],
    );
    if (!rows.length) throw new NotFoundException('Tax rule not found');
    return { deleted: true };
  }
}
