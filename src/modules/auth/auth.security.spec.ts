import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
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
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { UnauthorizedException } from '@nestjs/common';
import { authenticator } from 'otplib';

describe('AuthSecurity', () => {
  let authService: AuthService;
  let authController: AuthController;
  let jwtService: JwtService;
  let userManagementService: UserManagementService;

  const mockUserRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockUserManagementService = {
    findByEmail: jest.fn(),
    checkAccountLockout: jest.fn(),
    recordFailedLogin: jest.fn(),
    resetLockout: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-token'),
    verify: jest.fn(),
  };

  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn(),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: getRepositoryToken(Hotel), useValue: {} },
        { provide: getRepositoryToken(HotelUserAccess), useValue: {} },
        { provide: getRepositoryToken(Role), useValue: {} },
        { provide: getRepositoryToken(RolePermission), useValue: {} },
        { provide: getRepositoryToken(Permission), useValue: {} },
        { provide: getRepositoryToken(RefreshToken), useValue: {} },
        { provide: getRepositoryToken(AuditLog), useValue: {} },
        { provide: getRepositoryToken(SupportAccess), useValue: {} },
        { provide: UserManagementService, useValue: mockUserManagementService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: { get: jest.fn(), getOrThrow: jest.fn() } },
        { provide: RedisService, useValue: {} },
      ],
      controllers: [AuthController],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    authController = module.get<AuthController>(AuthController);
    jwtService = module.get<JwtService>(JwtService);
    userManagementService = module.get<UserManagementService>(UserManagementService);
  });

  describe('MFA Token', () => {
    it('should generate a token with type mfa', () => {
      authService.generateMfaToken('user-123', 'hotel-456');
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 'user-123', hotelId: 'hotel-456', type: 'mfa' },
        { expiresIn: '5m' },
      );
    });

    it('should verify and return payload for valid mfa token', () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-123', hotelId: 'hotel-456', type: 'mfa' });
      const result = authService.verifyMfaToken('valid-token');
      expect(result).toEqual({ userId: 'user-123', hotelId: 'hotel-456' });
    });

    it('should throw if token type is not mfa', () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-123', type: 'access' });
      expect(() => authService.verifyMfaToken('invalid-token')).toThrow(UnauthorizedException);
    });
  });

  describe('verify2FACode', () => {
    const user = { id: 'u1', email: 'test@example.com', twoFactorEnabled: true, twoFactorSecret: 'secret' };

    it('should record failed attempt on invalid code', async () => {
      mockUserRepository.findOne.mockResolvedValue(user);
      mockUserManagementService.findByEmail.mockResolvedValue({ id: 'p1' });
      mockUserManagementService.checkAccountLockout.mockResolvedValue({ locked: false });

      jest.spyOn(authenticator, 'verify').mockReturnValue(false);

      await expect(authService.verify2FACode('u1', '000000')).rejects.toThrow(UnauthorizedException);
      expect(mockUserManagementService.recordFailedLogin).toHaveBeenCalledWith('p1');
    });

    it('should throw if account is locked', async () => {
      mockUserRepository.findOne.mockResolvedValue(user);
      mockUserManagementService.findByEmail.mockResolvedValue({ id: 'p1' });
      mockUserManagementService.checkAccountLockout.mockResolvedValue({ locked: true, lockedUntil: new Date() });

      await expect(authService.verify2FACode('u1', '123456')).rejects.toThrow(UnauthorizedException);
    });
  });
});
