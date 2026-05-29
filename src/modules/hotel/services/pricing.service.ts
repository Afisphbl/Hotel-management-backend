import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Hotel } from '../../../database/entities/hotel.entity';

@Injectable()
export class PricingService {
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

  // ─── Calculate Price with Details ──────────────────────────────────────────

  async getEffectivePriceInfo(
    hotelId: string,
    roomTypeId: string,
    date: Date,
  ): Promise<{ price: number; reason: string | null; type: string | null; factors: string[] }> {
    const s = await this.getSchema(hotelId);
    const d = date.toISOString().split('T')[0];
    const factors: string[] = [];

    // 1. Base Price or Override
    let price = 0;
    const [ov] = await this.dataSource.query(
      `SELECT price, reason FROM "${s}"."price_overrides" WHERE "roomTypeId"=$1 AND date=$2 AND "deletedAt" IS NULL LIMIT 1`,
      [roomTypeId, d],
    );

    if (ov) {
      price = Number(ov.price);
      factors.push('Override');
    } else {
      const [rt] = await this.dataSource.query(
        `SELECT "basePrice" FROM "${s}"."room_types" WHERE id=$1 AND "deletedAt" IS NULL`,
        [roomTypeId],
      );
      if (!rt) return { price: 0, reason: null, type: null, factors: [] };
      price = Number(rt.basePrice);
    }

    let currentType: string | null = ov ? 'override' : null;

    // 2. Rate plan (Weekday/Weekend) - Multiplier
    const [rp] = await this.dataSource.query(
      `SELECT name, "weekdayAdjustment","weekendAdjustment" FROM "${s}"."rate_plans" WHERE "roomTypeId"=$1 AND "isActive"=true AND "deletedAt" IS NULL LIMIT 1`,
      [roomTypeId],
    );
    if (rp) {
      const isWeekend = [0, 6].includes(date.getUTCDay());
      const adj = isWeekend
        ? Number(rp.weekendAdjustment)
        : Number(rp.weekdayAdjustment);
      if (adj !== 0) {
        price += price * (adj / 100);
        factors.push(adj > 0 ? 'Rate Plan (+)' : 'Rate Plan (-)');
        if (!currentType) currentType = 'rate_plan';
      }
    }

    // 3. Seasonal rate
    const [sr] = await this.dataSource.query(
      `SELECT name, "fixedPrice", multiplier FROM "${s}"."seasonal_rates" WHERE "roomTypeId"=$1 AND "isActive"=true AND "startDate"<=$2 AND "endDate">=$2 AND "deletedAt" IS NULL ORDER BY priority DESC LIMIT 1`,
      [roomTypeId, d],
    );
    if (sr) {
      if (sr.fixedPrice) {
        price = Number(sr.fixedPrice);
        factors.push('Seasonal (Fixed)');
      } else if (sr.multiplier) {
        price *= Number(sr.multiplier);
        factors.push('Seasonal (Mult)');
      }
      if (!currentType || currentType === 'rate_plan') currentType = 'seasonal';
    }

    // 4. Promotion
    const [pr] = await this.dataSource.query(
      `SELECT name, "discountType","discountValue" FROM "${s}"."promotions" WHERE "roomTypeId"=$1 AND "isActive"=true AND "startDate"<=$2 AND "endDate">=$2 AND "deletedAt" IS NULL LIMIT 1`,
      [roomTypeId, d],
    );
    if (pr) {
      const oldPrice = price;
      price =
        pr.discountType === 'percentage'
          ? price - price * (Number(pr.discountValue) / 100)
          : price - Number(pr.discountValue);
      
      if (price !== oldPrice) {
        factors.push('Promotion');
        currentType = 'promotion';
      }
    }

    return {
      price: Math.max(0, Math.round(price * 100) / 100),
      reason: factors.join(' + '),
      type: currentType,
      factors,
    };
  }

  async calculatePrice(
    hotelId: string,
    roomTypeId: string,
    date: Date,
    opts?: { promotionCode?: string },
  ): Promise<number> {
    const s = await this.getSchema(hotelId);
    const d = date.toISOString().split('T')[0];

    // 1. Price override
    const [ov] = await this.dataSource.query(
      `SELECT price FROM "${s}"."price_overrides" WHERE "roomTypeId"=$1 AND date=$2 AND "deletedAt" IS NULL LIMIT 1`,
      [roomTypeId, d],
    );
    if (ov) return Math.max(0, Number(ov.price));

    // 2. Base price
    const [rt] = await this.dataSource.query(
      `SELECT "basePrice" FROM "${s}"."room_types" WHERE id=$1 AND "deletedAt" IS NULL`,
      [roomTypeId],
    );
    if (!rt) return 0;
    let price = Number(rt.basePrice);

    // 3. Rate plan weekday/weekend
    const [rp] = await this.dataSource.query(
      `SELECT "weekdayAdjustment","weekendAdjustment" FROM "${s}"."rate_plans" WHERE "roomTypeId"=$1 AND "isActive"=true AND "deletedAt" IS NULL LIMIT 1`,
      [roomTypeId],
    );
    if (rp) {
      const isWeekend = [0, 6].includes(date.getUTCDay());
      const adj = isWeekend
        ? Number(rp.weekendAdjustment)
        : Number(rp.weekdayAdjustment);
      if (adj) price += price * (adj / 100);
    }

    // 4. Seasonal rate
    const [sr] = await this.dataSource.query(
      `SELECT "fixedPrice",multiplier FROM "${s}"."seasonal_rates" WHERE "roomTypeId"=$1 AND "isActive"=true AND "startDate"<=$2 AND "endDate">=$2 AND "deletedAt" IS NULL ORDER BY priority DESC LIMIT 1`,
      [roomTypeId, d],
    );
    if (sr)
      price = sr.fixedPrice
        ? Number(sr.fixedPrice)
        : price * Number(sr.multiplier);

    // 5. Promotion
    const promoWhere = opts?.promotionCode ? `code=$1` : `"roomTypeId"=$1`;
    const promoParam = opts?.promotionCode ?? roomTypeId;
    const [pr] = await this.dataSource.query(
      `SELECT "discountType","discountValue" FROM "${s}"."promotions" WHERE ${promoWhere} AND "isActive"=true AND "startDate"<=$2 AND "endDate">=$2 AND "deletedAt" IS NULL LIMIT 1`,
      [promoParam, d],
    );
    if (pr)
      price =
        pr.discountType === 'percentage'
          ? price - price * (Number(pr.discountValue) / 100)
          : price - Number(pr.discountValue);

    return Math.max(0, Math.round(price * 100) / 100);
  }

  // ─── Price Overrides ────────────────────────────────────────────────────────

  async listOverrides(hotelId: string, roomTypeId?: string) {
    const s = await this.getSchema(hotelId);
    const params: any[] = [];
    let where = `o."deletedAt" IS NULL`;
    if (roomTypeId) {
      params.push(roomTypeId);
      where += ` AND o."roomTypeId"=$${params.length}`;
    }
    return this.dataSource.query(
      `SELECT o.*, rt.name AS "roomTypeName" FROM "${s}"."price_overrides" o LEFT JOIN "${s}"."room_types" rt ON rt.id=o."roomTypeId" WHERE ${where} ORDER BY o.date ASC`,
      params,
    );
  }

  async createOverride(hotelId: string, data: any) {
    const s = await this.getSchema(hotelId);
    const [row] = await this.dataSource.query(
      `INSERT INTO "${s}"."price_overrides" ("roomTypeId",date,price,reason,"createdBy") VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        data.roomTypeId,
        data.date,
        data.price,
        data.reason ?? null,
        data.createdBy ?? null,
      ],
    );
    return row;
  }

  async deleteOverride(hotelId: string, id: string) {
    const s = await this.getSchema(hotelId);
    await this.dataSource.query(
      `UPDATE "${s}"."price_overrides" SET "deletedAt"=NOW() WHERE id=$1`,
      [id],
    );
  }

  // ─── Promotions ─────────────────────────────────────────────────────────────

  async listPromotions(hotelId: string, roomTypeId?: string) {
    const s = await this.getSchema(hotelId);
    const params: any[] = [];
    let where = `p."deletedAt" IS NULL`;
    if (roomTypeId) {
      params.push(roomTypeId);
      where += ` AND p."roomTypeId"=$${params.length}`;
    }
    return this.dataSource.query(
      `SELECT p.*, rt.name AS "roomTypeName" FROM "${s}"."promotions" p LEFT JOIN "${s}"."room_types" rt ON rt.id=p."roomTypeId" WHERE ${where} ORDER BY p."startDate" DESC`,
      params,
    );
  }

  async createPromotion(hotelId: string, data: any) {
    const s = await this.getSchema(hotelId);
    const [row] = await this.dataSource.query(
      `INSERT INTO "${s}"."promotions" (name,description,code,"roomTypeId","discountType","discountValue","startDate","endDate","isActive") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        data.name,
        data.description ?? null,
        data.code ?? null,
        data.roomTypeId ?? null,
        data.discountType,
        data.discountValue,
        data.startDate,
        data.endDate,
        data.isActive ?? true,
      ],
    );
    return row;
  }

  async updatePromotion(hotelId: string, id: string, data: any) {
    const s = await this.getSchema(hotelId);
    const allowed = [
      'name',
      'description',
      'code',
      'roomTypeId',
      'discountType',
      'discountValue',
      'startDate',
      'endDate',
      'isActive',
    ];
    const fields: string[] = [];
    const params: any[] = [];
    for (const k of allowed) {
      if (data[k] !== undefined) {
        params.push(data[k]);
        fields.push(`"${k}"=$${params.length}`);
      }
    }
    if (!fields.length) return;
    params.push(id);
    const [row] = await this.dataSource.query(
      `UPDATE "${s}"."promotions" SET ${fields.join(',')}, "updatedAt"=NOW() WHERE id=$${params.length} AND "deletedAt" IS NULL RETURNING *`,
      params,
    );
    return row;
  }

  async deletePromotion(hotelId: string, id: string) {
    const s = await this.getSchema(hotelId);
    await this.dataSource.query(
      `UPDATE "${s}"."promotions" SET "deletedAt"=NOW() WHERE id=$1`,
      [id],
    );
  }

  // ─── Seasonal Rates ─────────────────────────────────────────────────────────

  async listSeasonalRates(hotelId: string, roomTypeId?: string) {
    const s = await this.getSchema(hotelId);
    const params: any[] = [];
    let where = `sr."deletedAt" IS NULL`;
    if (roomTypeId) {
      params.push(roomTypeId);
      where += ` AND sr."roomTypeId"=$${params.length}`;
    }
    return this.dataSource.query(
      `SELECT sr.*, rt.name AS "roomTypeName" FROM "${s}"."seasonal_rates" sr LEFT JOIN "${s}"."room_types" rt ON rt.id=sr."roomTypeId" WHERE ${where} ORDER BY sr."startDate" ASC`,
      params,
    );
  }

  async createSeasonalRate(hotelId: string, data: any) {
    const s = await this.getSchema(hotelId);
    const [row] = await this.dataSource.query(
      `INSERT INTO "${s}"."seasonal_rates" (name,"roomTypeId","startDate","endDate","fixedPrice",multiplier,priority,"isActive") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        data.name,
        data.roomTypeId,
        data.startDate,
        data.endDate,
        data.fixedPrice ?? null,
        data.multiplier ?? null,
        data.priority ?? 0,
        data.isActive ?? true,
      ],
    );
    return row;
  }

  async updateSeasonalRate(hotelId: string, id: string, data: any) {
    const s = await this.getSchema(hotelId);
    const allowed = [
      'name',
      'roomTypeId',
      'startDate',
      'endDate',
      'fixedPrice',
      'multiplier',
      'priority',
      'isActive',
    ];
    const fields: string[] = [];
    const params: any[] = [];
    for (const k of allowed) {
      if (data[k] !== undefined) {
        params.push(data[k]);
        fields.push(`"${k}"=$${params.length}`);
      }
    }
    if (!fields.length) return;
    params.push(id);
    const [row] = await this.dataSource.query(
      `UPDATE "${s}"."seasonal_rates" SET ${fields.join(',')}, "updatedAt"=NOW() WHERE id=$${params.length} AND "deletedAt" IS NULL RETURNING *`,
      params,
    );
    return row;
  }

  async deleteSeasonalRate(hotelId: string, id: string) {
    const s = await this.getSchema(hotelId);
    await this.dataSource.query(
      `UPDATE "${s}"."seasonal_rates" SET "deletedAt"=NOW() WHERE id=$1`,
      [id],
    );
  }

  // ─── Rate Plans ─────────────────────────────────────────────────────────────

  async listRatePlans(hotelId: string, roomTypeId?: string) {
    const s = await this.getSchema(hotelId);
    const params: any[] = [];
    let where = `rp."deletedAt" IS NULL`;
    if (roomTypeId) {
      params.push(roomTypeId);
      where += ` AND rp."roomTypeId"=$${params.length}`;
    }
    return this.dataSource.query(
      `SELECT rp.*, rt.name AS "roomTypeName" FROM "${s}"."rate_plans" rp LEFT JOIN "${s}"."room_types" rt ON rt.id=rp."roomTypeId" WHERE ${where} ORDER BY rp."createdAt" DESC`,
      params,
    );
  }

  async createRatePlan(hotelId: string, data: any) {
    const s = await this.getSchema(hotelId);
    const [row] = await this.dataSource.query(
      `INSERT INTO "${s}"."rate_plans" (name,description,"roomTypeId","weekdayAdjustment","weekendAdjustment","isActive") VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        data.name,
        data.description ?? null,
        data.roomTypeId,
        data.weekdayAdjustment ?? 0,
        data.weekendAdjustment ?? 0,
        data.isActive ?? true,
      ],
    );
    return row;
  }

  async updateRatePlan(hotelId: string, id: string, data: any) {
    const s = await this.getSchema(hotelId);
    const allowed = [
      'name',
      'description',
      'roomTypeId',
      'weekdayAdjustment',
      'weekendAdjustment',
      'isActive',
    ];
    const fields: string[] = [];
    const params: any[] = [];
    for (const k of allowed) {
      if (data[k] !== undefined) {
        params.push(data[k]);
        fields.push(`"${k}"=$${params.length}`);
      }
    }
    if (!fields.length) return;
    params.push(id);
    const [row] = await this.dataSource.query(
      `UPDATE "${s}"."rate_plans" SET ${fields.join(',')}, "updatedAt"=NOW() WHERE id=$${params.length} AND "deletedAt" IS NULL RETURNING *`,
      params,
    );
    return row;
  }

  async deleteRatePlan(hotelId: string, id: string) {
    const s = await this.getSchema(hotelId);
    await this.dataSource.query(
      `UPDATE "${s}"."rate_plans" SET "deletedAt"=NOW() WHERE id=$1`,
      [id],
    );
  }
}
