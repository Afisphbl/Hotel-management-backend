import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { RoomsService } from '../hotel/services/rooms.service';
import { RoomTypesService } from '../hotel/services/room-types.service';
import { PricingService } from '../hotel/services/pricing.service';

@Controller('public')
export class PublicRoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly roomTypesService: RoomTypesService,
    private readonly pricingService: PricingService,
  ) {}

  @Get('rooms')
  async findAll(
    @Query('hotelId') hotelId: string,
    @Query('roomTypeId') roomTypeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('minCapacity') minCapacity?: string,
    @Query('page') page?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('maxCapacity') maxCapacity?: string,
  ) {
    if (!hotelId) {
      throw new NotFoundException('hotelId is required');
    }

    const result = await this.roomsService.findAll(hotelId, {
      page: 1,
      limit: 200,
      roomTypeId,
      dateFrom: startDate,
      dateTo: endDate,
    });

    let rooms = result.items;

    if (minCapacity) {
      const cap = Number(minCapacity);
      rooms = rooms.filter(
        (r: any) => (r.baseCapacity || r.roomType?.baseCapacity || 0) >= cap,
      );
    }

    if (maxCapacity) {
      const cap = Number(maxCapacity);
      rooms = rooms.filter(
        (r: any) => (r.baseCapacity || r.roomType?.baseCapacity || 0) <= cap,
      );
    }

    const mapped = rooms.map((r: any) => ({
      id: r.id,
      roomNumber: r.roomNumber,
      floor: r.floor,
      roomTypeId: r.roomTypeId,
      roomType: r.roomType
        ? {
            id: r.roomType.id,
            name: r.roomType.name,
            baseCapacity: r.roomType.baseCapacity,
            maxExtraBeds: r.roomType.maxExtraBeds,
            basePrice: Number(r.roomType.basePrice),
            description: (r.roomType as any).description || null,
            image: (r.roomType as any).image || null,
          }
        : null,
      basePrice: r.basePrice != null ? Number(r.basePrice) : null,
      baseCapacity: r.baseCapacity,
      status: r.status,
      images: r.images || [],
      effectivePrice: r.effectivePrice != null ? Number(r.effectivePrice) : null,
      _sortPrice:
        r.effectivePrice != null
          ? Number(r.effectivePrice)
          : r.basePrice != null
            ? Number(r.basePrice)
            : r.roomType?.basePrice != null
              ? Number(r.roomType.basePrice)
              : 0,
      _sortCapacity: r.baseCapacity || r.roomType?.baseCapacity || 0,
      _sortFloor: r.floor || '',
      _sortRoomNumber: r.roomNumber || '',
    }));

    const validSortBy = ['floor', 'price', 'capacity', 'roomNumber'] as const;
    const field = (sortBy && validSortBy.includes(sortBy as any)) ? sortBy : 'floor';
    const order = sortOrder === 'desc' ? -1 : 1;

    mapped.sort((a: any, b: any) => {
      const sortKey = `_sort${field.charAt(0).toUpperCase() + field.slice(1)}`;
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string') {
        return order * aVal.localeCompare(bVal);
      }
      return order * (Number(aVal) - Number(bVal));
    });

    mapped.forEach((r: any) => {
      delete r._sortPrice;
      delete r._sortCapacity;
      delete r._sortFloor;
      delete r._sortRoomNumber;
    });

    const currentPage = Math.max(1, Number(page) || 1);
    const limit = 12;
    const total = mapped.length;
    const totalPages = Math.ceil(total / limit);
    const start = (currentPage - 1) * limit;
    const items = mapped.slice(start, start + limit);

    return {
      items,
      total,
      page: currentPage,
      limit,
      totalPages,
    };
  }

  @Get('rooms/availability')
  async getAvailability(
    @Query('hotelId') hotelId: string,
    @Query('roomTypeId') roomTypeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!hotelId) {
      throw new NotFoundException('hotelId is required');
    }

    return this.roomsService.getAvailability(
      hotelId,
      roomTypeId,
      startDate,
      endDate,
    );
  }

  @Get('rooms/booked-dates')
  async getBookedDates(
    @Query('hotelId') hotelId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('roomId') roomId?: string,
  ) {
    if (!hotelId) {
      throw new NotFoundException('hotelId is required');
    }

    if (roomId) {
      return this.getBookedDatesForRoom(hotelId, roomId, startDate, endDate);
    }

    return this.roomsService.getFullyBookedDates(
      hotelId,
      startDate || new Date().toISOString().split('T')[0],
      endDate ||
        new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
    );
  }

  @Post('rooms/calculate-price')
  async calculatePrice(
    @Body() body: { hotelId: string; roomId: string; checkIn: string; checkOut: string },
  ) {
    const { hotelId, roomId, checkIn, checkOut } = body;
    if (!hotelId || !roomId || !checkIn || !checkOut) {
      throw new NotFoundException('hotelId, roomId, checkIn, and checkOut are required');
    }

    // Get room to find roomTypeId and basePrice
    const room = await this.roomsService.findById(roomId, hotelId);
    const roomTypeId = room.roomTypeId;
    const basePrice = room.basePrice != null
      ? Number(room.basePrice)
      : (room as any).roomType?.basePrice != null
        ? Number((room as any).roomType.basePrice)
        : 0;

    // Generate dates between checkIn and checkOut
    const dates: string[] = [];
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const current = new Date(start);
    while (current < end) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 1);
    }

    const nights = await Promise.all(
      dates.map(async (date) => {
        const info = await this.pricingService.getEffectivePriceInfo(
          hotelId,
          roomTypeId,
          new Date(date),
          basePrice,
        );
        return { date, price: info.price, reason: info.reason, type: info.type, factors: info.factors };
      }),
    );

    const totalPrice = nights.reduce((sum, n) => sum + n.price, 0);
    const hasDynamicPricing = nights.some((n) => n.factors.length > 0);

    return { nights, totalPrice, basePrice, hasDynamicPricing };
  }

  @Get('rooms/:id')
  async findById(
    @Param('id') id: string,
    @Query('hotelId') hotelId: string,
  ) {
    if (!hotelId) {
      throw new NotFoundException('hotelId is required');
    }

    const room = await this.roomsService.findById(id, hotelId);
    return {
      id: room.id,
      roomNumber: room.roomNumber,
      floor: room.floor,
      roomTypeId: room.roomTypeId,
      roomType: (room as any).roomType
        ? {
            id: (room as any).roomType.id,
            name: (room as any).roomType.name,
            baseCapacity: (room as any).roomType.baseCapacity,
            maxExtraBeds: (room as any).roomType.maxExtraBeds,
            basePrice: Number((room as any).roomType.basePrice),
            description: (room as any).roomType?.description || null,
            image: (room as any).roomType?.image || null,
          }
        : null,
      basePrice: room.basePrice != null ? Number(room.basePrice) : null,
      baseCapacity: room.baseCapacity,
      status: room.status,
      images: room.images || [],
      effectivePrice: (room as any).effectivePrice != null
        ? Number((room as any).effectivePrice)
        : null,
    };
  }

  private async getBookedDatesForRoom(
    hotelId: string,
    roomId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<string[]> {
    const start =
      startDate || new Date().toISOString().split('T')[0];
    const end =
      endDate ||
      new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

    return this.roomsService.getBookedDatesForRoom(hotelId, roomId, start, end);
  }

  @Get('room-types')
  async getRoomTypes(@Query('hotelId') hotelId: string) {
    if (!hotelId) {
      throw new NotFoundException('hotelId is required');
    }

    const result = await this.roomTypesService.findAll(hotelId, {
      page: 1,
      limit: 50,
    });

    return result.items.map((rt: any) => ({
      id: rt.id,
      name: rt.name,
      description: rt.description,
      baseCapacity: rt.baseCapacity,
      maxExtraBeds: rt.maxExtraBeds,
      basePrice: Number(rt.basePrice),
      image: rt.image,
    }));
  }
}
