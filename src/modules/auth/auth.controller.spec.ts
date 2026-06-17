import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
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
            generateMfaToken: jest.fn(),
            verify2FACode: jest.fn(),
            login: jest.fn(),
            verifyMfaToken: jest.fn(),
            findUserById: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should return mfaToken when 2FA is required', async () => {
      const user = { id: 'user-1', twoFactorEnabled: true };
      (authService.validateUserWithFallback as jest.Mock).mockResolvedValue(user);
      (authService.generateMfaToken as jest.Mock).mockResolvedValue('mock-mfa-token');

      const result = await controller.login({ email: 'test@example.com', password: 'password' } as any, { headers: {}, ip: '127.0.0.1' } as any);

      expect(result).toEqual({
        requires_2fa: true,
        mfaToken: 'mock-mfa-token',
      });
      expect(authService.generateMfaToken).toHaveBeenCalledWith(user.id, null);
    });
  });

  describe('verify2fa', () => {
    it('should login successfully with valid mfaToken', async () => {
      const mfaToken = 'valid-mfa-token';
      const payload = { sub: 'user-1', hotelId: 'hotel-1' };
      const user = { id: 'user-1' };
      (authService.verifyMfaToken as jest.Mock).mockResolvedValue(payload);
      (authService.findUserById as jest.Mock).mockResolvedValue(user);
      (authService.login as jest.Mock).mockResolvedValue({ access_token: 'access' });

      const result = await controller.verify2fa({ code: '123456', mfaToken } as any, { headers: {}, ip: '127.0.0.1' } as any);

      expect(authService.verifyMfaToken).toHaveBeenCalledWith(mfaToken);
      expect(authService.findUserById).toHaveBeenCalledWith('user-1');
      expect(authService.login).toHaveBeenCalledWith(user, 'hotel-1', expect.any(Object));
      expect(result).toEqual({ access_token: 'access' });
    });

    it('should throw UnauthorizedException when mfaToken is invalid', async () => {
      (authService.verifyMfaToken as jest.Mock).mockRejectedValue(new Error('Invalid token'));

      await expect(controller.verify2fa({ code: '123456', mfaToken: 'bad' } as any, {} as any)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when no identifier is provided', async () => {
      await expect(controller.verify2fa({ code: '123456' } as any, {} as any)).rejects.toThrow('MFA token is required');
    });
  });
});
