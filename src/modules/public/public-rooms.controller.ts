import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { RoomsService } from '../hotel/services/rooms.service';
import { RoomTypesService } from '../hotel/services/room-types.service';

@Controller('public')
export class PublicRoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly roomTypesService: RoomTypesService,
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

    const availability = await this.roomsService.getAvailability(
      hotelId,
      undefined,
      start,
      end,
    );

    const roomAvailability = availability.find(
      (a: any) => a.room?.id === roomId,
    );
    if (!roomAvailability) return [];

    const dates: string[] = [];
    const curr = new Date(start);
    const last = new Date(end);
    while (curr < last) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }

    return roomAvailability.available ? [] : dates;
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
