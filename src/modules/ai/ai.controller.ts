import { Controller, Post, Body, HttpCode, HttpStatus, Query, BadRequestException, NotFoundException } from '@nestjs/common';
import { AiService } from './ai.service';
import { HotelManagementService } from '../hotel/services/hotel-management.service';
import { RoomTypesService } from '../hotel/services/room-types.service';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly hotelManagementService: HotelManagementService,
    private readonly roomTypesService: RoomTypesService,
  ) {}

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testAi(@Body('prompt') prompt: string) {
    const response = await this.aiService.generateResponse(prompt || 'Hello, are you ready?');
    return {
      success: true,
      message: 'AI response generated successfully',
      response,
    };
  }

  @Post('interpret-search')
  @HttpCode(HttpStatus.OK)
  async interpretSearch(
    @Body('query') query: string,
    @Query('hotelId') hotelId: string,
  ) {
    if (!hotelId) {
      throw new BadRequestException('hotelId is required');
    }

    // Fetch context for the AI
    const hotel = await this.hotelManagementService.findOne(hotelId);
    if (!hotel) {
      throw new NotFoundException('Hotel not found');
    }

    const roomTypesResult = await this.roomTypesService.findAll(hotelId, { page: 1, limit: 100 });

    const context = {
      hotelName: hotel.name,
      hotelDescription: hotel.description,
      location: hotel.location,
      roomTypes: roomTypesResult.items.map(rt => ({
        id: rt.id,
        name: rt.name,
        description: rt.description,
        basePrice: rt.basePrice,
        baseCapacity: rt.baseCapacity,
      })),
    };

    const filters = await this.aiService.interpretSearch(query, context);

    return {
      success: true,
      filters,
    };
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(
    @Body('message') message: string,
    @Body('history') history: any[],
    @Body('user') user: any,
    @Query('hotelId') hotelId: string,
  ) {
    if (!hotelId) {
      throw new BadRequestException('hotelId is required');
    }

    // Fetch context for the AI
    const hotel = await this.hotelManagementService.findOne(hotelId);
    if (!hotel) {
      throw new NotFoundException('Hotel not found');
    }

    const roomTypesResult = await this.roomTypesService.findAll(hotelId, { page: 1, limit: 100 });

    const context = {
      hotelName: hotel.name,
      hotelDescription: hotel.description,
      location: hotel.location,
      roomTypes: roomTypesResult.items.map(rt => ({
        name: rt.name,
        description: rt.description,
        basePrice: rt.basePrice,
        baseCapacity: rt.baseCapacity,
      })),
    };

    const response = await this.aiService.chat(message, history || [], context, hotelId, user);

    return {
      success: true,
      response,
    };
  }
}
