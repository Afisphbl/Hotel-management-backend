import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            extractHotelSlugFromEmail: jest.fn(),
            findHotelBySlug: jest.fn(),
            findHotelBySubdomain: jest.fn(),
            findHotelById: jest.fn(),
            validateUserWithFallback: jest.fn(),
            verify2FACode: jest.fn(),
            generateMfaToken: jest.fn(),
            verifyMfaToken: jest.fn(),
            login: jest.fn(),
            findUserById: jest.fn(),
          },
        },
      ],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should return mfaToken when 2FA is required', async () => {
      const loginDto = { email: 'test@example.com', password: 'password' };
      const user = { id: 'user-id', twoFactorEnabled: true };

      (authService.validateUserWithFallback as jest.Mock).mockResolvedValue(user);
      (authService.generateMfaToken as jest.Mock).mockReturnValue('mfa-token');

      const result = await authController.login(loginDto as any, { headers: {}, ip: '127.0.0.1' });

      expect(result).toEqual({
        requires_2fa: true,
        mfaToken: 'mfa-token',
      });
      expect(authService.generateMfaToken).toHaveBeenCalledWith(user.id, null);
    });
  });

  describe('verify2fa', () => {
    it('should extract userId and hotelId from mfaToken and login', async () => {
      const dto = { mfaToken: 'mfa-token', code: '123456' };
      const payload = { sub: 'user-id', hotelId: 'hotel-id' };
      const user = { id: 'user-id' };

      (authService.verifyMfaToken as jest.Mock).mockReturnValue(payload);
      (authService.findUserById as jest.Mock).mockResolvedValue(user);
      (authService.verify2FACode as jest.Mock).mockResolvedValue(true);
      (authService.login as jest.Mock).mockResolvedValue({ access_token: 'access-token' });

      const result = await authController.verify2fa(dto, { headers: {}, ip: '127.0.0.1' });

      expect(authService.verifyMfaToken).toHaveBeenCalledWith('mfa-token');
      expect(authService.verify2FACode).toHaveBeenCalledWith(user.id, '123456');
      expect(authService.login).toHaveBeenCalledWith(user, 'hotel-id', expect.any(Object));
      expect(result).toEqual({ access_token: 'access-token' });
    });

    it('should throw UnauthorizedException if mfaToken is invalid', async () => {
      const dto = { mfaToken: 'invalid-token', code: '123456' };
      (authService.verifyMfaToken as jest.Mock).mockImplementation(() => {
        throw new UnauthorizedException('Invalid or expired MFA token');
      });

      await expect(authController.verify2fa(dto, { headers: {}, ip: '127.0.0.1' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});
