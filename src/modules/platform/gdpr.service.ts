import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { Guest } from '../../database/entities/guest.entity';
import { Hotel } from '../../database/entities/hotel.entity';

@Injectable()
export class GdprService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
  ) {}

  async exportUserData(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 1. Basic Profile Data
    const exportData: any = {
      profile: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        scope: user.scope,
        role: user.role?.name,
        createdAt: user.createdAt,
      },
      tenantAccess: [],
      guestProfiles: [],
    };

    // 2. Cross-Tenant Data
    const hotels = await this.hotelRepository.find();
    for (const hotel of hotels) {
      try {
        // Check if user exists as a guest in this hotel schema
        const guests = await this.dataSource.query(
          `SELECT * FROM "${hotel.schemaName}"."guests" WHERE email = $1`,
          [user.email],
        );

        if (guests && guests.length > 0) {
          exportData.guestProfiles.push({
            hotelName: hotel.name,
            profiles: guests,
          });
        }

        // Check for bookings
        const bookings = await this.dataSource.query(
          `SELECT b.* FROM "${hotel.schemaName}"."bookings" b
           JOIN "${hotel.schemaName}"."guests" g ON b."guestId" = g.id
           WHERE g.email = $1`,
          [user.email],
        );

        if (bookings && bookings.length > 0) {
          const hotelEntry = exportData.tenantAccess.find((t: any) => t.hotelId === hotel.id) || {
            hotelId: hotel.id,
            hotelName: hotel.name,
            bookings: [],
          };
          hotelEntry.bookings = bookings;
          if (!exportData.tenantAccess.includes(hotelEntry)) {
            exportData.tenantAccess.push(hotelEntry);
          }
        }
      } catch (e) {
        // Schema might not exist or be accessible
      }
    }

    return exportData;
  }

  async anonymizeUser(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const email = user.email;
    const anonymizedValue = `anonymized_${userId.slice(0, 8)}`;

    // 1. Anonymize Global User Record
    user.email = `${anonymizedValue}@anonymized.local`;
    user.firstName = 'Anonymized';
    user.lastName = 'User';
    user.password = 'ANONYMIZED';
    user.isActive = false;
    await this.userRepository.save(user);

    // 2. Anonymize Guest Records across all schemas
    const hotels = await this.hotelRepository.find();
    for (const hotel of hotels) {
      try {
        await this.dataSource.query(
          `UPDATE "${hotel.schemaName}"."guests"
           SET "firstName" = 'Anonymized',
               "lastName" = 'User',
               "email" = $1,
               "phone" = 'ANONYMIZED',
               "address" = 'ANONYMIZED'
           WHERE "email" = $2`,
          [`${anonymizedValue}@anonymized.local`, email],
        );
      } catch (e) {
        // Schema might not exist
      }
    }

    return { success: true, userId };
  }
}
