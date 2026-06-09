import { Controller, Post, Body, HttpCode, HttpStatus, Query, BadRequestException, NotFoundException, UseGuards, Request } from '@nestjs/common';
import { AiService } from './ai.service';
import { HotelManagementService } from '../hotel/services/hotel-management.service';
import { RoomTypesService } from '../hotel/services/room-types.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';

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

    const result = await this.aiService.chat(message, history || [], context, hotelId, user);

    return {
      success: true,
      response: result.text,
      checkoutUrl: result.checkoutUrl,
    };
  }

  @Post('staff-chat')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, ScopeGuard)
  @Scopes(UserScope.HOTEL)
  async staffChat(
    @Body('message') message: string,
    @Body('history') history: any[],
    @Request() req: any,
  ) {
    if (!message) throw new BadRequestException('message is required');
    const hotelId = req.user.hotel_id || req.user.hotelId;
    const userId = req.user.userId || req.user.sub;
    const role = req.user.role;
    if (!['HOTEL_ADMIN', 'HOTEL_MANAGER', 'SUPER_ADMIN'].includes(role)) {
      throw new BadRequestException('Insufficient role for staff AI');
    }
    const result = await this.aiService.staffChat(message, history || [], hotelId, userId);
    return { success: true, response: result.text };
  }
}
