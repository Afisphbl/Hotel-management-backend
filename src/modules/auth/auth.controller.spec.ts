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
    findUserById: jest.fn(),
    verify2FACode: jest.fn(),
    login: jest.fn(),
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

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('verify2fa', () => {
    it('FIX VERIFICATION: should require a valid mfaToken and verify it', async () => {
      const mockUser = { id: 'user-uuid', email: 'test@example.com' };
      const mfaToken = 'valid-mfa-token';
      const mfaPayload = { sub: 'user-uuid', email: 'test@example.com', type: 'mfa', hotelId: null };

      mockAuthService.verifyMfaToken.mockReturnValue(mfaPayload);
      mockAuthService.findUserById.mockResolvedValue(mockUser);
      mockAuthService.verify2FACode.mockResolvedValue(true);
      mockAuthService.login.mockResolvedValue({ access_token: 'fake-jwt' });

      const result = await controller.verify2fa(
        { code: '123456', mfaToken },
        { headers: {}, ip: '127.0.0.1' },
      );

      expect(result).toEqual({ access_token: 'fake-jwt' });
      expect(mockAuthService.verifyMfaToken).toHaveBeenCalledWith(mfaToken);
      expect(mockAuthService.findUserById).toHaveBeenCalledWith('user-uuid');
      expect(mockAuthService.verify2FACode).toHaveBeenCalledWith(mockUser, '123456');
    });

    it('FIX VERIFICATION: should fail if mfaToken is invalid', async () => {
      mockAuthService.verifyMfaToken.mockImplementation(() => {
        throw new UnauthorizedException('Invalid or expired MFA token');
      });

      await expect(
        controller.verify2fa(
          { code: '123456', mfaToken: 'invalid-token' },
          { headers: {}, ip: '127.0.0.1' },
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
