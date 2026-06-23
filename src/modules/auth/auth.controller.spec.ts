import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    extractHotelSlugFromEmail: jest.fn(),
    findHotelBySlug: jest.fn(),
    findHotelBySubdomain: jest.fn(),
    findHotelById: jest.fn(),
    validateUserWithFallback: jest.fn(),
    generateMfaToken: jest.fn(),
    verifyMfaToken: jest.fn(),
    findUserById: jest.fn(),
    verify2FACode: jest.fn(),
    login: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
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

      mockAuthService.validateUserWithFallback.mockResolvedValue(user);
      mockAuthService.generateMfaToken.mockReturnValue('mfa-token');

      const result = await authController.login(loginDto, { headers: {}, ip: '127.0.0.1' });

      expect(result).toEqual({
        requires_2fa: true,
        mfaToken: 'mfa-token',
      });
      expect(mockAuthService.generateMfaToken).toHaveBeenCalledWith(user.id, null);
    });
  });

  describe('verify2fa', () => {
    it('should login successfully with a valid mfaToken', async () => {
      const verify2faDto = { code: '123456', mfaToken: 'valid-mfa-token' };
      const payload = { sub: 'user-id', hotelId: 'hotel-id', type: 'mfa' };
      const user = { id: 'user-id' };

      mockAuthService.verifyMfaToken.mockReturnValue(payload);
      mockAuthService.findUserById.mockResolvedValue(user);
      mockAuthService.verify2FACode.mockResolvedValue(true);
      mockAuthService.login.mockResolvedValue({ access_token: 'access-token' });

      const result = await authController.verify2fa(verify2faDto, { headers: {}, ip: '127.0.0.1' });

      expect(result).toEqual({ access_token: 'access-token' });
      expect(mockAuthService.verifyMfaToken).toHaveBeenCalledWith('valid-mfa-token');
      expect(mockAuthService.login).toHaveBeenCalledWith(user, 'hotel-id', expect.any(Object));
    });

    it('should throw UnauthorizedException if mfaToken is invalid', async () => {
      const verify2faDto = { code: '123456', mfaToken: 'invalid-mfa-token' };

      mockAuthService.verifyMfaToken.mockImplementation(() => {
        throw new UnauthorizedException('Invalid or expired MFA token');
      });

      await expect(authController.verify2fa(verify2faDto, { headers: {}, ip: '127.0.0.1' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});
