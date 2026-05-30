import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Hotel } from '../../database/entities/hotel.entity';

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    private dataSource: DataSource,
  ) {}

  private schemaCache = new Map<string, string>();

  private async getSchema(hotelId: string): Promise<string> {
    if (this.schemaCache.has(hotelId)) return this.schemaCache.get(hotelId)!;
    const hotel = await this.hotelRepository.findOne({ where: { id: hotelId } });
    const schema = hotel?.schemaName?.replace(/[^a-zA-Z0-9_]/g, '') ?? 'public';
    this.schemaCache.set(hotelId, schema);
    return schema;
  }

  async calculatePrice(
    hotelId: string,
    roomTypeId: string,
    date: Date,
    opts?: { roomBasePrice?: number | null },
  ): Promise<number> {
    const s = await this.getSchema(hotelId);
    const d = date.toISOString().split('T')[0];

    // 1. Price override (highest priority)
    const [ov] = await this.dataSource.query(
      `SELECT price FROM "${s}"."price_overrides" WHERE "roomTypeId"=$1 AND date=$2 AND "deletedAt" IS NULL LIMIT 1`,
      [roomTypeId, d],
    );
    if (ov) {
      this.logger.debug(`PriceOverride found: ${ov.price}`);
      return Math.max(0, Number(ov.price));
    }

    // 2. Base price
    let price: number;
    if (opts?.roomBasePrice != null) {
      price = Number(opts.roomBasePrice);
    } else {
      const [rt] = await this.dataSource.query(
        `SELECT "basePrice" FROM "${s}"."room_types" WHERE id=$1 AND "deletedAt" IS NULL LIMIT 1`,
        [roomTypeId],
      );
      if (!rt) return 0;
      price = Number(rt.basePrice);
    }

    // 3. Rate plan weekday/weekend adjustment
    const [rp] = await this.dataSource.query(
      `SELECT "weekdayAdjustment","weekendAdjustment" FROM "${s}"."rate_plans" WHERE "roomTypeId"=$1 AND "isActive"=true AND "deletedAt" IS NULL LIMIT 1`,
      [roomTypeId],
    );
    if (rp) {
      const isWeekend = [0, 6].includes(date.getUTCDay());
      const adj = isWeekend ? Number(rp.weekendAdjustment) : Number(rp.weekdayAdjustment);
      if (adj !== 0) {
        price += price * (adj / 100);
        this.logger.debug(`RatePlan adjustment: ${adj}% → ${price}`);
      }
    }

    // 4. Seasonal rate
    const [sr] = await this.dataSource.query(
      `SELECT "fixedPrice", multiplier, name FROM "${s}"."seasonal_rates" WHERE "roomTypeId"=$1 AND "isActive"=true AND "startDate"<=$2 AND "endDate">=$2 AND "deletedAt" IS NULL ORDER BY priority DESC LIMIT 1`,
      [roomTypeId, d],
    );
    if (sr) {
      if (sr.fixedPrice) price = Number(sr.fixedPrice);
      else if (sr.multiplier) price *= Number(sr.multiplier);
      this.logger.debug(`SeasonalRate "${sr.name}" applied → ${price}`);
    }

    // 5. Promotion
    const [pr] = await this.dataSource.query(
      `SELECT name, "discountType", "discountValue" FROM "${s}"."promotions" WHERE ("roomTypeId"=$1 OR "roomTypeId" IS NULL) AND "isActive"=true AND "startDate"<=$2 AND "endDate">=$2 AND "deletedAt" IS NULL ORDER BY "roomTypeId" DESC NULLS LAST, "createdAt" DESC LIMIT 1`,
      [roomTypeId, d],
    );
    if (pr) {
      price = pr.discountType === 'percentage'
        ? price - price * (Number(pr.discountValue) / 100)
        : price - Number(pr.discountValue);
      this.logger.debug(`Promotion "${pr.name}" applied → ${price}`);
    }

    return Math.max(0, Math.round(price * 100) / 100);
  }
}
