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
    verify2FACode: jest.fn(),
    login: jest.fn(),
    verifyMfaToken: jest.fn(),
    findUserById: jest.fn(),
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

  describe('verify-2fa', () => {
    it('should successfully login with a valid mfaToken', async () => {
      const dto = { code: '123456', mfaToken: 'valid-token' };
      const payload = { sub: 'user-id', hotelId: 'hotel-id', type: 'mfa' };
      const user = { id: 'user-id', email: 'test@example.com' };
      const loginResult = { access_token: 'abc.def.ghi' }; // Mock JWT format for Buffer.from in controller

      mockAuthService.verifyMfaToken.mockResolvedValue(payload);
      mockAuthService.findUserById.mockResolvedValue(user);
      mockAuthService.verify2FACode.mockResolvedValue(true);
      mockAuthService.login.mockResolvedValue(loginResult);

      const result = await controller.verify2fa(dto, { headers: {}, ip: '127.0.0.1' });

      expect(result).toBe(loginResult);
      expect(authService.verifyMfaToken).toHaveBeenCalledWith('valid-token');
      expect(authService.findUserById).toHaveBeenCalledWith('user-id');
      expect(authService.verify2FACode).toHaveBeenCalledWith('user-id', '123456');
      expect(authService.login).toHaveBeenCalledWith(user, 'hotel-id', expect.any(Object));
    });

    it('should throw UnauthorizedException if mfaToken is invalid', async () => {
      const dto = { code: '123456', mfaToken: 'invalid-token' };
      mockAuthService.verifyMfaToken.mockRejectedValue(new UnauthorizedException('Invalid or expired MFA token'));

      await expect(controller.verify2fa(dto, { headers: {}, ip: '127.0.0.1' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const dto = { code: '123456', mfaToken: 'valid-token' };
      mockAuthService.verifyMfaToken.mockResolvedValue({ sub: 'non-existent', type: 'mfa' });
      mockAuthService.findUserById.mockResolvedValue(null);

      await expect(controller.verify2fa(dto, { headers: {}, ip: '127.0.0.1' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});
