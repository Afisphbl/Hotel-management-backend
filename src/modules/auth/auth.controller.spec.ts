import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

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
            extractHotelSlugFromEmail: jest.fn(),
            findHotelBySlug: jest.fn(),
            findHotelBySubdomain: jest.fn(),
            findHotelById: jest.fn(),
            validateUserWithFallback: jest.fn(),
            generateMfaToken: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  describe('verify2fa', () => {
    it('should successfully login with valid mfaToken and code', async () => {
      const mockPayload = { sub: 'user-id', hotelId: 'hotel-id', type: 'mfa' };
      const mockUser = { id: 'user-id', email: 'test@example.com' };
      const dto = { mfaToken: 'valid-token', code: '123456' };
      const req = { headers: {}, ip: '127.0.0.1' };

      authService.verifyMfaToken.mockResolvedValue(mockPayload);
      authService.findUserById.mockResolvedValue(mockUser as any);
      authService.verify2FACode.mockResolvedValue(true);
      authService.login.mockResolvedValue({ access_token: 'jwt' } as any);

      const result = await controller.verify2fa(dto, req);

      expect(authService.verifyMfaToken).toHaveBeenCalledWith('valid-token');
      expect(authService.findUserById).toHaveBeenCalledWith('user-id');
      expect(authService.verify2FACode).toHaveBeenCalledWith(
        'user-id',
        '123456',
      );
      expect(authService.login).toHaveBeenCalledWith(
        mockUser,
        'hotel-id',
        expect.any(Object),
      );
      expect(result).toEqual({ access_token: 'jwt' });
    });

    it('should throw UnauthorizedException if mfaToken is invalid', async () => {
      const dto = { mfaToken: 'invalid-token', code: '123456' };
      const req = { headers: {}, ip: '127.0.0.1' };

      authService.verifyMfaToken.mockRejectedValue(
        new UnauthorizedException('Invalid or expired MFA token'),
      );

      await expect(controller.verify2fa(dto, req)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const mockPayload = {
        sub: 'non-existent',
        hotelId: 'hotel-id',
        type: 'mfa',
      };
      const dto = { mfaToken: 'valid-token', code: '123456' };
      const req = { headers: {}, ip: '127.0.0.1' };

      authService.verifyMfaToken.mockResolvedValue(mockPayload);
      authService.findUserById.mockResolvedValue(null);

      await expect(controller.verify2fa(dto, req)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
