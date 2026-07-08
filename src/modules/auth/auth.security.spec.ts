import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { UserManagementService } from '../platform/user-management.service';

describe('AuthSecurity', () => {
  let controller: AuthController;
  let authService: AuthService;
  let userManagementService: UserManagementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            findUserById: jest.fn(),
            verify2FACode: jest.fn(),
            verifyMfaToken: jest.fn(),
            login: jest.fn(),
          },
        },
        {
          provide: UserManagementService,
          useValue: {
            findByEmail: jest.fn(),
            recordFailedLogin: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    userManagementService = module.get<UserManagementService>(UserManagementService);
  });

  describe('verify-2fa security', () => {
    it('should reject invalid MFA tokens', async () => {
      (authService.verifyMfaToken as jest.Mock).mockRejectedValue(new UnauthorizedException('Invalid or expired MFA token'));

      await expect(controller.verify2fa({ code: '123456', mfaToken: 'invalid' }, { ip: '127.0.0.1', headers: {} }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should correctly extract userId from valid MFA token and proceed', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      (authService.verifyMfaToken as jest.Mock).mockResolvedValue({ sub: 'user-123', hotel_id: null, type: 'mfa' });
      (authService.findUserById as jest.Mock).mockResolvedValue(mockUser);
      (authService.verify2FACode as jest.Mock).mockResolvedValue(true);
      (authService.login as jest.Mock).mockResolvedValue({ access_token: 'new-token' });

      const result = await controller.verify2fa({ code: '123456', mfaToken: 'valid-token' }, { ip: '127.0.0.1', headers: {} });

      expect(authService.verifyMfaToken).toHaveBeenCalledWith('valid-token');
      expect(authService.findUserById).toHaveBeenCalledWith('user-123');
      expect(authService.verify2FACode).toHaveBeenCalledWith('user-123', '123456', '127.0.0.1');
      expect(result).toEqual({ access_token: 'new-token' });
    });
  });

  describe('AuthService MFA failed attempts', () => {
    it('should record failed MFA attempts via userManagementService', async () => {
      // We need a real AuthService instance or a more complex mock to test the interaction
      // but let's test that verify2FACode calls recordFailedLogin on failure
      const realAuthService = new AuthService(
        { findOne: jest.fn() } as any, // userRepository
        {} as any, // hotelRepository
        {} as any, // accessRepository
        {} as any, // roleRepository
        {} as any, // rolePermissionRepository
        {} as any, // permissionRepository
        {} as any, // refreshTokenRepository
        {} as any, // auditLogRepository
        {} as any, // supportAccessRepository
        {} as any, // dataSource
        {} as any, // jwtService
        {} as any, // configService
        userManagementService,
        {} as any, // redisService
      );

      const mockUser = { id: 'user-123', email: 'test@example.com', twoFactorEnabled: true, twoFactorSecret: 'secret' };
      const userRepository = (realAuthService as any).userRepository;
      userRepository.findOne.mockResolvedValue(mockUser);
      (userManagementService.findByEmail as jest.Mock).mockResolvedValue({ id: 'platform-user-123' });

      // Mock authenticator to fail
      const { authenticator } = require('otplib');
      jest.spyOn(authenticator, 'verify').mockReturnValue(false);

      await expect(realAuthService.verify2FACode('user-123', 'wrong-code', '192.168.1.1'))
        .rejects.toThrow(UnauthorizedException);

      expect(userManagementService.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(userManagementService.recordFailedLogin).toHaveBeenCalledWith('platform-user-123', '192.168.1.1');
    });
  });
});
