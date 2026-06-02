import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Hotel } from '../../database/entities/hotel.entity';
import { HotelUserAccess } from '../../database/entities/hotel-user-access.entity';
import { NotificationService } from '../workers/services/notification.service';
import { NotificationType } from '../../database/entities/notification.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    @InjectRepository(HotelUserAccess)
    private hotelUserAccessRepository: Repository<HotelUserAccess>,
    private dataSource: DataSource,
    private notificationService: NotificationService,
  ) {}

  private async getSchema(hotelId: string): Promise<string> {
    const hotel = await this.hotelRepository.findOne({
      where: { id: hotelId },
    });
    if (!hotel?.schemaName)
      throw new NotFoundException('Hotel schema not found');
    return hotel.schemaName.replace(/[^a-zA-Z0-9_]/g, '');
  }

  async findByRoomId(hotelId: string, roomId: string) {
    const s = await this.getSchema(hotelId);
    const rows = await this.dataSource.query(
      `SELECT r.*, g."firstName", g."lastName"
       FROM "${s}"."reviews" r
       JOIN "${s}"."guests" g ON g.id = r."guestId"
       WHERE r."roomId" = $1 AND r."isVisible" = TRUE AND r."deletedAt" IS NULL
       ORDER BY r."createdAt" DESC`,
      [roomId],
    );
    return rows;
  }

  async create(hotelId: string, guestId: string, dto: { roomId: string, rating: number, comment: string }) {
    const s = await this.getSchema(hotelId);
    
    // Check if room exists
    const room = await this.dataSource.query(
      `SELECT id FROM "${s}"."rooms" WHERE id = $1 AND "deletedAt" IS NULL`,
      [dto.roomId]
    );
    if (!room.length) throw new NotFoundException('Room not found');

    const result = await this.dataSource.query(
      `INSERT INTO "${s}"."reviews" ("rating", "comment", "roomId", "guestId", "hotelId")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [dto.rating, dto.comment, dto.roomId, guestId, hotelId]
    );

    // Notify hotel admins
    this.notifyAdmins(hotelId, dto.rating, s).catch(() => {});

    return result[0];
  }

  async getAverageRating(hotelId: string, roomId: string) {
    const s = await this.getSchema(hotelId);
    const result = await this.dataSource.query(
      `SELECT AVG(rating)::float as average, COUNT(*)::int as count
       FROM "${s}"."reviews"
       WHERE "roomId" = $1 AND "isVisible" = TRUE AND "deletedAt" IS NULL`,
      [roomId]
    );
    return {
      average: result[0]?.average || 0,
      count: result[0]?.count || 0
    };
  }

  private async notifyAdmins(hotelId: string, rating: number, schema: string): Promise<void> {
    const [admins, todayResult] = await Promise.all([
      this.hotelUserAccessRepository.find({
        where: { hotelId, revokedAt: null as any },
        select: ['userId'],
      }),
      this.dataSource.query(
        `SELECT COUNT(*)::int as count FROM "${schema}"."reviews"
         WHERE "hotelId" = $1 AND "createdAt" >= CURRENT_DATE AND "deletedAt" IS NULL`,
        [hotelId],
      ),
    ]);

    if (!admins.length) return;

    const count: number = todayResult[0]?.count ?? 1;
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);

    await this.notificationService.sendBulk(
      admins.map(({ userId }) => ({
        userId,
        type: NotificationType.NEW_REVIEW,
        title: `New Guest Review ${stars}`,
        body: `A guest left a ${rating}-star review. ${count} review${count !== 1 ? 's' : ''} today.`,
        data: { hotelId, rating, todayCount: count },
      })),
    );
  }
}
