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
import { UserManagementService } from '../platform/user-management.service';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { authenticator } from 'otplib';

describe('AuthService Security', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let userManagementService: UserManagementService;
  let userRepository: any;

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
        {
          provide: UserManagementService,
          useValue: {
            findByEmail: jest.fn(),
            recordFailedLogin: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        { provide: getRepositoryToken(Hotel), useValue: {} },
        { provide: getRepositoryToken(HotelUserAccess), useValue: {} },
        { provide: getRepositoryToken(Role), useValue: {} },
        { provide: getRepositoryToken(RolePermission), useValue: {} },
        { provide: getRepositoryToken(Permission), useValue: {} },
        { provide: getRepositoryToken(RefreshToken), useValue: {} },
        { provide: getRepositoryToken(AuditLog), useValue: {} },
        { provide: getRepositoryToken(SupportAccess), useValue: {} },
        { provide: RedisService, useValue: {} },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn(), get: jest.fn() } },
        { provide: DataSource, useValue: { getRepository: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    userManagementService = module.get<UserManagementService>(UserManagementService);
    userRepository = module.get(getRepositoryToken(User));
  });

  describe('MFA Token', () => {
    it('should generate a signed MFA token', () => {
      const user = { id: 'user-123' };
      const hotelId = 'hotel-456';

      const token = service.generateMfaToken(user, hotelId);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: user.id, hotelId, type: 'mfa' },
        { expiresIn: '5m' }
      );
      expect(token).toBe('mock-token');
    });

    it('should verify a valid MFA token', () => {
      const payload = { sub: 'user-123', hotelId: 'hotel-456', type: 'mfa' };
      (jwtService.verify as jest.Mock).mockReturnValue(payload);

      const result = service.verifyMfaToken('valid-token');

      expect(result).toEqual({ userId: 'user-123', hotelId: 'hotel-456' });
    });

    it('should throw UnauthorizedException for invalid token type', () => {
      const payload = { sub: 'user-123', type: 'access' };
      (jwtService.verify as jest.Mock).mockReturnValue(payload);

      expect(() => service.verifyMfaToken('invalid-token')).toThrow(UnauthorizedException);
    });
  });

  describe('verify2FACode', () => {
    it('should record failed attempt when 2FA code is invalid', async () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        twoFactorEnabled: true,
        twoFactorSecret: 'secret'
      };
      userRepository.findOne.mockResolvedValue(user);
      jest.spyOn(authenticator, 'verify').mockReturnValue(false);
      (userManagementService.findByEmail as jest.Mock).mockResolvedValue({ id: 'platform-user-1' });

      await expect(service.verify2FACode('user-1', '000000')).rejects.toThrow(UnauthorizedException);

      expect(userManagementService.recordFailedLogin).toHaveBeenCalledWith('platform-user-1');
    });
  });
});
