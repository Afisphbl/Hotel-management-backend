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
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-token'),
            verify: jest.fn(),
          },
        },
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
        { provide: ConfigService, useValue: {} },
        { provide: UserManagementService, useValue: {} },
        { provide: RedisService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateMfaToken', () => {
    it('should generate a signed MFA token', async () => {
      const userId = 'user-123';
      const hotelId = 'hotel-456';
      const token = await service.generateMfaToken(userId, hotelId);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: userId, hotelId: hotelId, type: 'mfa' },
        { expiresIn: '5m' },
      );
      expect(token).toBe('mock-token');
    });
  });

  describe('verifyMfaToken', () => {
    it('should return payload if token is valid and of type mfa', async () => {
      const payload = { sub: 'user-123', hotelId: 'hotel-456', type: 'mfa' };
      (jwtService.verify as jest.Mock).mockReturnValue(payload);

      const result = await service.verifyMfaToken('valid-token');
      expect(result).toEqual(payload);
    });

    it('should throw UnauthorizedException if token type is not mfa', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({ type: 'access' });
      await expect(service.verifyMfaToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw if jwtService.verify throws', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid');
      });
      await expect(service.verifyMfaToken('bad-token')).rejects.toThrow();
    });
  });
});
