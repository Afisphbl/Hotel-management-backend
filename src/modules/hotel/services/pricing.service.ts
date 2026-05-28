import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { RoomType } from '../../../database/entities/room-type.entity';
import { PriceOverride } from '../../../database/entities/price-override.entity';
import { Promotion } from '../../../database/entities/promotion.entity';
import { SeasonalRate } from '../../../database/entities/seasonal-rate.entity';
import { RatePlan } from '../../../database/entities/rate-plan.entity';

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(RoomType)
    private roomTypeRepo: Repository<RoomType>,
    @InjectRepository(PriceOverride)
    private overrideRepo: Repository<PriceOverride>,
    @InjectRepository(Promotion)
    private promotionRepo: Repository<Promotion>,
    @InjectRepository(SeasonalRate)
    private seasonalRepo: Repository<SeasonalRate>,
    @InjectRepository(RatePlan)
    private ratePlanRepo: Repository<RatePlan>,
  ) {}

  // ─── Calculate Price ────────────────────────────────────────────────────────

  async calculatePrice(
    roomTypeId: string,
    date: Date,
    overrides?: { promotionCode?: string },
  ): Promise<number> {
    const dateStr = date.toISOString().split('T')[0];

    const override = await this.overrideRepo.findOne({ where: { roomTypeId, date: dateStr } });
    if (override) return Math.max(0, Number(override.price));

    const roomType = await this.roomTypeRepo.findOneBy({ id: roomTypeId });
    if (!roomType) return 0;

    let price = Number(roomType.basePrice);

    const ratePlan = await this.ratePlanRepo.findOne({ where: { roomTypeId, isActive: true } });
    if (ratePlan) {
      const isWeekend = [0, 6].includes(date.getUTCDay());
      const adj = isWeekend ? Number(ratePlan.weekendAdjustment) : Number(ratePlan.weekdayAdjustment);
      if (adj !== 0) price = price + price * (adj / 100);
    }

    const seasonal = await this.seasonalRepo.findOne({
      where: {
        roomTypeId,
        isActive: true,
        startDate: LessThanOrEqual(dateStr),
        endDate: MoreThanOrEqual(dateStr),
      },
      order: { priority: 'DESC' },
    });
    if (seasonal) {
      if (seasonal.fixedPrice) price = Number(seasonal.fixedPrice);
      else if (seasonal.multiplier) price = price * Number(seasonal.multiplier);
    }

    const promo = await this.promotionRepo.findOne({
      where: {
        ...(overrides?.promotionCode ? { code: overrides.promotionCode } : { roomTypeId }),
        isActive: true,
        startDate: LessThanOrEqual(dateStr),
        endDate: MoreThanOrEqual(dateStr),
      },
    });
    if (promo) {
      price = promo.discountType === 'percentage'
        ? price - price * (Number(promo.discountValue) / 100)
        : price - Number(promo.discountValue);
    }

    return Math.max(0, Math.round(price * 100) / 100);
  }

  // ─── Price Overrides ────────────────────────────────────────────────────────

  async listOverrides(roomTypeId?: string): Promise<PriceOverride[]> {
    return this.overrideRepo.find({
      where: roomTypeId ? { roomTypeId } : {},
      relations: ['roomType'],
      order: { date: 'ASC' },
    });
  }

  async createOverride(data: Partial<PriceOverride>): Promise<PriceOverride> {
    return this.overrideRepo.save(this.overrideRepo.create(data));
  }

  async deleteOverride(id: string): Promise<void> {
    const entity = await this.overrideRepo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Price override not found');
    await this.overrideRepo.remove(entity);
  }

  // ─── Promotions ─────────────────────────────────────────────────────────────

  async listPromotions(roomTypeId?: string): Promise<Promotion[]> {
    return this.promotionRepo.find({
      where: roomTypeId ? { roomTypeId } : {},
      relations: ['roomType'],
      order: { startDate: 'DESC' },
    });
  }

  async createPromotion(data: Partial<Promotion>): Promise<Promotion> {
    return this.promotionRepo.save(this.promotionRepo.create(data));
  }

  async updatePromotion(id: string, data: Partial<Promotion>): Promise<Promotion> {
    const entity = await this.promotionRepo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Promotion not found');
    Object.assign(entity, data);
    return this.promotionRepo.save(entity);
  }

  async deletePromotion(id: string): Promise<void> {
    const entity = await this.promotionRepo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Promotion not found');
    await this.promotionRepo.remove(entity);
  }

  // ─── Seasonal Rates ─────────────────────────────────────────────────────────

  async listSeasonalRates(roomTypeId?: string): Promise<SeasonalRate[]> {
    return this.seasonalRepo.find({
      where: roomTypeId ? { roomTypeId } : {},
      relations: ['roomType'],
      order: { startDate: 'ASC' },
    });
  }

  async createSeasonalRate(data: Partial<SeasonalRate>): Promise<SeasonalRate> {
    return this.seasonalRepo.save(this.seasonalRepo.create(data));
  }

  async updateSeasonalRate(id: string, data: Partial<SeasonalRate>): Promise<SeasonalRate> {
    const entity = await this.seasonalRepo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Seasonal rate not found');
    Object.assign(entity, data);
    return this.seasonalRepo.save(entity);
  }

  async deleteSeasonalRate(id: string): Promise<void> {
    const entity = await this.seasonalRepo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Seasonal rate not found');
    await this.seasonalRepo.remove(entity);
  }

  // ─── Rate Plans ─────────────────────────────────────────────────────────────

  async listRatePlans(roomTypeId?: string): Promise<RatePlan[]> {
    return this.ratePlanRepo.find({
      where: roomTypeId ? { roomTypeId } : {},
      relations: ['roomType'],
      order: { createdAt: 'DESC' },
    });
  }

  async createRatePlan(data: Partial<RatePlan>): Promise<RatePlan> {
    return this.ratePlanRepo.save(this.ratePlanRepo.create(data));
  }

  async updateRatePlan(id: string, data: Partial<RatePlan>): Promise<RatePlan> {
    const entity = await this.ratePlanRepo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Rate plan not found');
    Object.assign(entity, data);
    return this.ratePlanRepo.save(entity);
  }

  async deleteRatePlan(id: string): Promise<void> {
    const entity = await this.ratePlanRepo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Rate plan not found');
    await this.ratePlanRepo.remove(entity);
  }
}
