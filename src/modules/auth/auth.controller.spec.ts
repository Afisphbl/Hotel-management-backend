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

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  describe('verify2fa', () => {
    it('should successfully login with a valid mfaToken', async () => {
      const dto = { code: '123456', mfaToken: 'valid-token' };
      const req = { headers: {}, ip: '127.0.0.1' };
      const payload = { sub: 'user-id', hotelId: 'hotel-id', type: 'mfa' };
      const user = { id: 'user-id', email: 'test@example.com' };

      mockAuthService.verifyMfaToken.mockReturnValue(payload);
      mockAuthService.findUserById.mockResolvedValue(user);
      mockAuthService.verify2FACode.mockResolvedValue(true);
      mockAuthService.login.mockResolvedValue({ access_token: 'jwt' });

      const result = await controller.verify2fa(dto, req);

      expect(authService.verifyMfaToken).toHaveBeenCalledWith('valid-token');
      expect(authService.findUserById).toHaveBeenCalledWith('user-id');
      expect(authService.verify2FACode).toHaveBeenCalledWith('user-id', '123456');
      expect(authService.login).toHaveBeenCalledWith(user, 'hotel-id', expect.any(Object));
      expect(result).toEqual({ access_token: 'jwt' });
    });

    it('should throw UnauthorizedException if mfaToken is invalid', async () => {
      const dto = { code: '123456', mfaToken: 'invalid-token' };
      const req = { headers: {}, ip: '127.0.0.1' };

      mockAuthService.verifyMfaToken.mockImplementation(() => {
        throw new UnauthorizedException('Invalid or expired MFA token');
      });

      await expect(controller.verify2fa(dto, req)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const dto = { code: '123456', mfaToken: 'valid-token' };
      const req = { headers: {}, ip: '127.0.0.1' };
      const payload = { sub: 'non-existent', hotelId: null, type: 'mfa' };

      mockAuthService.verifyMfaToken.mockReturnValue(payload);
      mockAuthService.findUserById.mockResolvedValue(null);

      await expect(controller.verify2fa(dto, req)).rejects.toThrow('User not found');
    });
  });
});
