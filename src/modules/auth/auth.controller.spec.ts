import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    findUserById: jest.fn(),
    verify2FACode: jest.fn(),
    login: jest.fn(),
    validateUserWithFallback: jest.fn(),
    extractHotelSlugFromEmail: jest.fn(),
    findHotelBySlug: jest.fn(),
    findHotelBySubdomain: jest.fn(),
    findHotelById: jest.fn(),
    generateMfaToken: jest.fn(),
    verifyMfaToken: jest.fn(),
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

  describe('verify2fa bypass fix', () => {
    it('should NOT allow login with just userId (now mfaToken is required)', async () => {
      const dto = { userId: 'user-123', code: '123456' };
      const req = { headers: {}, ip: '127.0.0.1' };

      // This should fail because mfaToken is missing in the DTO (if validation pipe was running)
      // and our controller now calls verifyMfaToken.

      mockAuthService.verifyMfaToken.mockImplementation(() => {
        throw new UnauthorizedException('Invalid token');
      });

      await expect(controller.verify2fa(dto as any, req as any))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should allow login with a valid mfaToken and code', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mfaToken = 'valid-mfa-token';
      const hotelId = 'hotel-456';

      mockAuthService.verifyMfaToken.mockReturnValue({ sub: 'user-123', hotelId, type: 'mfa' });
      mockAuthService.findUserById.mockResolvedValue(mockUser);
      mockAuthService.verify2FACode.mockResolvedValue(true);
      mockAuthService.login.mockResolvedValue({ access_token: 'fake-token' });

      const dto = { mfaToken, code: '123456' };
      const req = { headers: {}, ip: '127.0.0.1' };

      const result = await controller.verify2fa(dto as any, req as any);

      expect(result).toEqual({ access_token: 'fake-token' });
      expect(mockAuthService.verifyMfaToken).toHaveBeenCalledWith(mfaToken);
      expect(mockAuthService.findUserById).toHaveBeenCalledWith('user-123');
      expect(mockAuthService.verify2FACode).toHaveBeenCalledWith('user-123', '123456');
      expect(mockAuthService.login).toHaveBeenCalledWith(mockUser, hotelId, expect.any(Object));
    });
  });

  describe('login with 2FA requirement', () => {
      it('should return mfaToken when 2FA is required', async () => {
          const mockUser = { id: 'user-123', email: 'test@example.com', twoFactorEnabled: true };
          mockAuthService.validateUserWithFallback.mockResolvedValue(mockUser);
          mockAuthService.generateMfaToken.mockReturnValue('mocked-mfa-token');

          const loginDto = { email: 'test@example.com', password: 'password123' };
          const req = { headers: {}, ip: '127.0.0.1' };

          const result = await controller.login(loginDto as any, req as any);

          expect(result).toEqual({
              requires_2fa: true,
              mfaToken: 'mocked-mfa-token'
          });
          expect(mockAuthService.generateMfaToken).toHaveBeenCalledWith(mockUser, null);
      });
  });
});
