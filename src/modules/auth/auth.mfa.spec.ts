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
import { authenticator } from 'otplib';

describe('AuthService MFA', () => {
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
        { provide: DataSource, useValue: {} },
        { provide: ConfigService, useValue: {} },
        {
          provide: UserManagementService,
          useValue: {
            findByEmail: jest.fn(),
            recordFailedLogin: jest.fn(),
          },
        },
        { provide: RedisService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    userManagementService = module.get<UserManagementService>(UserManagementService);
    userRepository = module.get(getRepositoryToken(User));
  });

  describe('verifyMfaToken', () => {
    it('should throw UnauthorizedException if token type is not mfa', () => {
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: 'user-id', type: 'access' });
      expect(() => service.verifyMfaToken('invalid-token')).toThrow(UnauthorizedException);
    });

    it('should return userId and hotelId for valid mfa token', () => {
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: 'user-id', hotelId: 'hotel-id', type: 'mfa' });
      const result = service.verifyMfaToken('valid-token');
      expect(result).toEqual({ userId: 'user-id', hotelId: 'hotel-id' });
    });
  });

  describe('verify2FACode', () => {
    it('should record failed login if 2FA code is invalid', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        twoFactorEnabled: true,
        twoFactorSecret: 'secret',
      });
      jest.spyOn(authenticator, 'verify').mockReturnValue(false);
      (userManagementService.findByEmail as jest.Mock).mockResolvedValue({ id: 'platform-user-id' });

      await expect(service.verify2FACode('user-id', '000000')).rejects.toThrow(UnauthorizedException);
      expect(userManagementService.recordFailedLogin).toHaveBeenCalledWith('platform-user-id');
    });
  });
});
