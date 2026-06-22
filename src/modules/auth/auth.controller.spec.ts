import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const mockAuthService = {
      findUserById: jest.fn(),
      verify2FACode: jest.fn(),
      login: jest.fn(),
      extractHotelSlugFromEmail: jest.fn(),
      verifyMfaToken: jest.fn(),
      generateMfaToken: jest.fn(),
      validateUserWithFallback: jest.fn(),
      findHotelBySlug: jest.fn(),
      findHotelBySubdomain: jest.fn(),
      findHotelById: jest.fn(),
    };

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
    authService = module.get(AuthService);
  });

  describe('verify2fa secure flow', () => {
    it('should successfully verify 2FA with a valid mfaToken', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      authService.verifyMfaToken.mockReturnValue({ userId: 'user-123', hotelId: 'hotel-456' });
      authService.findUserById.mockResolvedValue(mockUser as any);
      authService.verify2FACode.mockResolvedValue(true as any);
      authService.login.mockResolvedValue({ access_token: 'mock-session-token' } as any);

      const dto = {
        code: '123456',
        mfaToken: 'valid-mfa-token',
      };

      const result = await controller.verify2fa(dto, { headers: {}, ip: '127.0.0.1' });

      expect(authService.verifyMfaToken).toHaveBeenCalledWith('valid-mfa-token');
      expect(authService.findUserById).toHaveBeenCalledWith('user-123');
      expect(authService.verify2FACode).toHaveBeenCalledWith('user-123', '123456');
      expect(authService.login).toHaveBeenCalledWith(mockUser, 'hotel-456', expect.any(Object));
      expect(result).toEqual({ access_token: 'mock-session-token' });
    });

    it('should throw UnauthorizedException if mfaToken is invalid', async () => {
      authService.verifyMfaToken.mockImplementation(() => {
        throw new UnauthorizedException('Invalid or expired MFA token');
      });

      const dto = {
        code: '123456',
        mfaToken: 'invalid-token',
      };

      await expect(controller.verify2fa(dto, { headers: {}, ip: '127.0.0.1' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login with 2FA required', () => {
    it('should return mfaToken when 2FA is enabled and code is missing', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com', twoFactorEnabled: true };
      authService.validateUserWithFallback.mockResolvedValue(mockUser);
      authService.generateMfaToken.mockReturnValue('generated-mfa-token');

      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = await controller.login(loginDto, { headers: {}, ip: '127.0.0.1' });

      expect(result).toEqual({
        requires_2fa: true,
        mfaToken: 'generated-mfa-token',
      });
      expect(authService.generateMfaToken).toHaveBeenCalledWith('user-123', null);
    });
  });
});
