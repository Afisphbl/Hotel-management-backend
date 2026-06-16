import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { Hotel } from '../../database/entities/hotel.entity';
import { HotelUserAccess } from '../../database/entities/hotel-user-access.entity';
import { Role } from '../../database/entities/role.entity';
import { RolePermission } from '../../database/entities/role-permission.entity';
import { Permission } from '../../database/entities/permission.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { SupportAccess } from '../../database/entities/global/support-access.entity';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { UserManagementService } from '../platform/user-management.service';
import { RedisService } from '../redis/redis.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(Hotel), useValue: {} },
        { provide: getRepositoryToken(HotelUserAccess), useValue: {} },
        { provide: getRepositoryToken(Role), useValue: {} },
        { provide: getRepositoryToken(RolePermission), useValue: {} },
        { provide: getRepositoryToken(Permission), useValue: {} },
        { provide: getRepositoryToken(RefreshToken), useValue: {} },
        { provide: getRepositoryToken(AuditLog), useValue: {} },
        { provide: getRepositoryToken(SupportAccess), useValue: {} },
        { provide: DataSource, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: UserManagementService, useValue: {} },
        { provide: RedisService, useValue: {} },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('signed-token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('generateMfaToken', () => {
    it('should sign a token with userId, hotelId and purpose', () => {
      const token = service.generateMfaToken('user-123', 'hotel-456');

      expect(token).toBe('signed-token');
      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          sub: 'user-123',
          hotelId: 'hotel-456',
          purpose: 'mfa_verification',
        },
        {
          expiresIn: '5m',
        },
      );
    });

    it('should handle null hotelId', () => {
        service.generateMfaToken('user-123', null);

        expect(jwtService.sign).toHaveBeenCalledWith(
          expect.objectContaining({
            hotelId: null,
          }),
          expect.any(Object),
        );
      });
  });
});
