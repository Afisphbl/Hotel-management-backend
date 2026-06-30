import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    extractHotelSlugFromEmail: jest.fn(),
    findHotelBySlug: jest.fn(),
    findHotelBySubdomain: jest.fn(),
    findHotelById: jest.fn(),
    validateUserWithFallback: jest.fn(),
    generateMfaToken: jest.fn(),
    verifyMfaToken: jest.fn(),
    verify2FACode: jest.fn(),
    findUserById: jest.fn(),
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

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  describe('login with 2FA required', () => {
    it('should return mfaToken when 2FA is enabled', async () => {
      const loginDto = { email: 'test@example.com', password: 'password' };
      const user = { id: 'user-123', twoFactorEnabled: true };

      mockAuthService.validateUserWithFallback.mockResolvedValue(user);
      mockAuthService.generateMfaToken.mockReturnValue('mfa-token-123');

      const result = await controller.login(loginDto, { headers: {}, ip: '127.0.0.1' });

      expect(result).toEqual({
        requires_2fa: true,
        mfaToken: 'mfa-token-123',
      });
      expect(authService.generateMfaToken).toHaveBeenCalledWith('user-123', null);
    });
  });

  describe('verify2fa', () => {
    it('should login user when mfaToken and code are valid', async () => {
      const verifyDto = { code: '123456', mfaToken: 'valid-mfa-token' };
      const user = { id: 'user-123' };

      mockAuthService.verifyMfaToken.mockReturnValue({ userId: 'user-123', hotelId: 'hotel-456' });
      mockAuthService.findUserById.mockResolvedValue(user);
      mockAuthService.verify2FACode.mockResolvedValue(true);
      mockAuthService.login.mockResolvedValue({ access_token: 'jwt-token' });

      const result = await controller.verify2fa(verifyDto, { headers: {}, ip: '127.0.0.1' });

      expect(result).toEqual({ access_token: 'jwt-token' });
      expect(authService.verifyMfaToken).toHaveBeenCalledWith('valid-mfa-token');
      expect(authService.login).toHaveBeenCalledWith(user, 'hotel-456', expect.any(Object));
    });

    it('should throw UnauthorizedException if mfaToken is invalid', async () => {
      const verifyDto = { code: '123456', mfaToken: 'invalid-mfa-token' };

      mockAuthService.verifyMfaToken.mockImplementation(() => {
        throw new UnauthorizedException('Invalid MFA token');
      });

      await expect(controller.verify2fa(verifyDto, { headers: {}, ip: '127.0.0.1' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});
