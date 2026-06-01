import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Hotel, HotelStatus } from '../../database/entities/hotel.entity';

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    private dataSource: DataSource,
    private jwtService: JwtService,
  ) {}

  async findHotelBySubdomain(subdomain: string) {
    const hotel = await this.hotelRepository.findOne({
      where: { subdomain, status: HotelStatus.ACTIVE },
    });

    if (!hotel) {
      throw new NotFoundException('Hotel not found');
    }

    return {
      id: hotel.id,
      name: hotel.name,
      slug: hotel.slug,
      subdomain: hotel.subdomain,
      schemaName: hotel.schemaName,
      timezone: hotel.timezone || 'UTC',
      currency: hotel.currency || 'USD',
      status: hotel.status,
      branding: hotel.branding || {
        primaryColor: '#0F1B2D',
        accentColor: '#C9973A',
        logo: null,
        favicon: '/favicon.ico',
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

    const access_token = this.jwtService.sign(payload);

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
}
