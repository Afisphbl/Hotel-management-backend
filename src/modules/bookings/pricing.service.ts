import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomType } from '../../database/entities/room-type.entity';

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(RoomType)
    private roomTypeRepository: Repository<RoomType>,
  ) {}

  async calculatePrice(
    roomTypeId: string,
    date: Date,
    overrides?: any,
  ): Promise<number> {
    // 1. Check for manual overrides (highest priority)
    // 2. Check for active promotions
    // 3. Check for seasonal rates
    // 4. Check for weekday rules
    // 5. Fallback to base rate
    
    // Simplified for now: return base price
    const roomType = await this.roomTypeRepository.findOneBy({ id: roomTypeId });
    return roomType ? Number(roomType.basePrice) : 0;
  }
}
