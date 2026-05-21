import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, IsNull } from 'typeorm';
import { RoomType } from '../../database/entities/room-type.entity';
import { SeasonalRate } from '../../database/entities/seasonal-rate.entity';
import {
  Promotion,
  DiscountType,
} from '../../database/entities/promotion.entity';
import { PriceOverride } from '../../database/entities/price-override.entity';
import { RatePlan } from '../../database/entities/rate-plan.entity';

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    @InjectRepository(RoomType)
    private roomTypeRepository: Repository<RoomType>,
    @InjectRepository(SeasonalRate)
    private seasonalRateRepository: Repository<SeasonalRate>,
    @InjectRepository(Promotion)
    private promotionRepository: Repository<Promotion>,
    @InjectRepository(PriceOverride)
    private priceOverrideRepository: Repository<PriceOverride>,
    @InjectRepository(RatePlan)
    private ratePlanRepository: Repository<RatePlan>,
  ) {}

  async calculatePrice(
    roomTypeId: string,
    date: Date,
    overrides?: { promotionCode?: string },
  ): Promise<number> {
    // 1. Highest priority: manual price override for this room type + date
    const override = await this.priceOverrideRepository.findOne({
      where: { roomTypeId, date: this.toDateString(date) },
    });
    if (override) {
      this.logger.debug(`PriceOverride found: ${override.price}`);
      return Math.max(0, Number(override.price));
    }

    // 2. Start with base price
    const roomType = await this.roomTypeRepository.findOneBy({
      id: roomTypeId,
    });
    if (!roomType) {
      this.logger.warn(`RoomType ${roomTypeId} not found`);
      return 0;
    }

    let price = Number(roomType.basePrice);

    // 3. Apply RatePlan weekday/weekend adjustment
    const ratePlan = await this.ratePlanRepository.findOne({
      where: { roomTypeId, isActive: true },
    });
    if (ratePlan) {
      const adjustment = this.isWeekend(date)
        ? Number(ratePlan.weekendAdjustment)
        : Number(ratePlan.weekdayAdjustment);
      if (adjustment !== 0) {
        price = price + price * (adjustment / 100);
        this.logger.debug(`RatePlan adjustment: ${adjustment}% → ${price}`);
      }
    }

    // 4. Apply SeasonalRate (replaces or multiplies the price)
    const seasonal = await this.seasonalRateRepository.findOne({
      where: {
        roomTypeId,
        isActive: true,
        startDate: LessThanOrEqual(this.toDateString(date)),
        endDate: MoreThanOrEqual(this.toDateString(date)),
      },
      order: { priority: 'DESC' },
    });
    if (seasonal) {
      if (seasonal.fixedPrice) {
        price = Number(seasonal.fixedPrice);
      } else if (seasonal.multiplier) {
        price = price * Number(seasonal.multiplier);
      }
      this.logger.debug(`SeasonalRate "${seasonal.name}" applied → ${price}`);
    }

    // 5. Apply Promotion discount
    const promoCode = overrides?.promotionCode;
    const promo = promoCode
      ? await this.promotionRepository.findOne({
          where: {
            code: promoCode,
            isActive: true,
            startDate: LessThanOrEqual(this.toDateString(date)),
            endDate: MoreThanOrEqual(this.toDateString(date)),
          },
        })
      : await this.promotionRepository.findOne({
          where: {
            roomTypeId: IsNull(),
            isActive: true,
            startDate: LessThanOrEqual(this.toDateString(date)),
            endDate: MoreThanOrEqual(this.toDateString(date)),
          },
          order: { createdAt: 'DESC' },
        });

    if (promo) {
      if (promo.discountType === DiscountType.PERCENTAGE) {
        price = price - price * (Number(promo.discountValue) / 100);
        this.logger.debug(
          `Promotion "${promo.name}" ${promo.discountValue}% off → ${price}`,
        );
      } else {
        price = price - Number(promo.discountValue);
        this.logger.debug(
          `Promotion "${promo.name}" ETB ${promo.discountValue} off → ${price}`,
        );
      }
    }

    return Math.max(0, Math.round(price * 100) / 100);
  }

  private toDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private isWeekend(date: Date): boolean {
    const dow = date.getUTCDay();
    return dow === 0 || dow === 6;
  }
}
