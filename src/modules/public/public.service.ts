import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { PasswordPolicyService } from '../../common/services/password-policy.service';
import * as bcrypt from 'bcrypt';
import { Hotel, HotelStatus } from '../../database/entities/hotel.entity';

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    private dataSource: DataSource,
    private jwtService: JwtService,
    private readonly passwordPolicyService: PasswordPolicyService,
  ) {}

  async findHotelBySubdomain(subdomain: string) {
    const hotel = await this.hotelRepository.findOne({
      where: { subdomain },
    });

    if (!hotel || hotel.status === HotelStatus.INACTIVE) {
      throw new NotFoundException('Hotel not found');
    }

    return this.mapHotel(hotel);
  }

  async findHotelById(id: string) {
    const hotel = await this.hotelRepository.findOne({
      where: { id, status: HotelStatus.ACTIVE },
    });
    if (!hotel) throw new NotFoundException('Hotel not found');
    return this.mapHotel(hotel);
  }

  private mapHotel(hotel: Hotel) {
    return {
      id: hotel.id,
      name: hotel.name,
      description: hotel.description || null,
      slug: hotel.slug,
      subdomain: hotel.subdomain,
      schemaName: hotel.schemaName,
      timezone: hotel.timezone || 'UTC',
      currency: hotel.currency || 'USD',
      status: hotel.status,
      branding: {
        primaryColor: hotel.branding?.primaryColor || '#0F1B2D',
        accentColor: hotel.branding?.accentColor || '#C9973A',
        logo: hotel.branding?.logo || null,
        favicon: hotel.branding?.favicon || '/favicon.ico',
        homePageImage: hotel.branding?.homePageImage || null,
      },
      settings: {
        aboutContent: hotel.settings?.aboutContent || null,
      },
    };
  }

  async registerGuest(dto: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    hotelId: string;
  }) {
    const hotel = await this.hotelRepository.findOne({
      where: { id: dto.hotelId, status: HotelStatus.ACTIVE },
    });
    if (!hotel) throw new NotFoundException('Hotel not found');

    const schema = hotel.schemaName;

    // Check if guest already exists in this hotel's schema
    const existing = await this.dataSource.query(
      `SELECT id FROM "${schema}"."guests" WHERE email = $1 LIMIT 1`,
      [dto.email],
    );
    if (existing.length > 0) {
      throw new ConflictException('A guest with this email already exists');
    }

    await this.passwordPolicyService.assertCompliant(dto.password);

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const result = await this.dataSource.query(
      `INSERT INTO "${schema}"."guests" ("firstName", "lastName", email, "passwordHash")
       VALUES ($1, $2, $3, $4)
       RETURNING id, "firstName", "lastName", email`,
      [dto.firstName, dto.lastName, dto.email, passwordHash],
    );

    return result[0];
  }

  async loginGuest(dto: { email: string; password: string; hotelId: string }) {
    const hotel = await this.hotelRepository.findOne({
      where: { id: dto.hotelId, status: HotelStatus.ACTIVE },
    });
    if (!hotel) throw new NotFoundException('Hotel not found');

    const schema = hotel.schemaName;

    const rows = await this.dataSource.query(
      `SELECT id, "firstName", "lastName", email, "passwordHash"
       FROM "${schema}"."guests"
       WHERE email = $1
       LIMIT 1`,
      [dto.email],
    );

    if (rows.length === 0) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const guest = rows[0];
    const valid = await bcrypt.compare(dto.password, guest.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: guest.id,
      hotel_id: dto.hotelId,
      role: 'GUEST',
      scope: 'HOTEL',
      permissions: ['guest:book', 'guest:view'],
    };

    const access_token = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      access_token,
      guest: {
        id: guest.id,
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
      },
    };
  }

  async getMe(token: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const hotel = await this.hotelRepository.findOne({
      where: { id: payload.hotel_id, status: HotelStatus.ACTIVE },
    });
    if (!hotel) throw new NotFoundException('Hotel not found');

    const rows = await this.dataSource.query(
      `SELECT id, "firstName", "lastName", email, nationality, "countryFlag", "nationalID", "isVip"
       FROM "${hotel.schemaName}"."guests"
       WHERE id = $1
       LIMIT 1`,
      [payload.sub],
    );

    if (rows.length === 0) throw new NotFoundException('Guest not found');

    return {
      id: rows[0].id,
      firstName: rows[0].firstName,
      lastName: rows[0].lastName,
      email: rows[0].email,
      nationality: rows[0].nationality || null,
      countryFlag: rows[0].countryFlag || null,
      nationalID: rows[0].nationalID || null,
      isVip: rows[0].isVip || false,
    };
  }

  async getMyBookings(token: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const hotel = await this.hotelRepository.findOne({
      where: { id: payload.hotel_id, status: HotelStatus.ACTIVE },
    });
    if (!hotel) throw new NotFoundException('Hotel not found');

    const rows = await this.dataSource.query(
      `SELECT b.id, b."checkIn", b."checkOut", b.status, b."totalPrice",
              b."numGuests", b."notes", b."createdAt", b."updatedAt",
              r.id AS "roomId", r."roomNumber", r.images,
              rt.name AS "roomTypeName", rt."baseCapacity" AS "maxCapacity",
              br.price AS "roomPrice"
       FROM "${hotel.schemaName}"."bookings" b
       LEFT JOIN "${hotel.schemaName}"."booking_rooms" br ON br."bookingId" = b.id
       LEFT JOIN "${hotel.schemaName}"."rooms" r ON r.id = br."roomId"
       LEFT JOIN "${hotel.schemaName}"."room_types" rt ON rt.id = r."roomTypeId"
       WHERE b."guestId" = $1 AND b."deletedAt" IS NULL
       ORDER BY b."checkIn" DESC`,
      [payload.sub],
    );

    return rows.map((row) => ({
      id: row.id,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      status: row.status,
      totalPrice: Number(row.totalPrice),
      numGuests: row.numGuests,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      room: row.roomId
        ? {
            id: row.roomId,
            name: row.roomNumber,
            image: row.images?.[0] || null,
            roomTypeName: row.roomTypeName,
            maxCapacity: row.maxCapacity,
            price: row.roomPrice ? Number(row.roomPrice) : null,
          }
        : null,
    }));
  }

  async updateMe(
    token: string,
    data: { nationality?: string; nationalID?: string; countryFlag?: string },
  ) {
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const hotel = await this.hotelRepository.findOne({
      where: { id: payload.hotel_id, status: HotelStatus.ACTIVE },
    });
    if (!hotel) throw new NotFoundException('Hotel not found');

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.nationality !== undefined) {
      sets.push(`nationality = $${idx++}`);
      params.push(data.nationality);
    }
    if (data.nationalID !== undefined) {
      sets.push(`"nationalID" = $${idx++}`);
      params.push(data.nationalID);
    }
    if (data.countryFlag !== undefined) {
      sets.push(`"countryFlag" = $${idx++}`);
      params.push(data.countryFlag);
    }

    if (sets.length === 0) {
      return this.getMe(token);
    }

    params.push(payload.sub);
    await this.dataSource.query(
      `UPDATE "${hotel.schemaName}"."guests" SET ${sets.join(', ')} WHERE id = $${idx}`,
      params,
    );

    return this.getMe(token);
  }
}
