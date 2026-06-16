import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController (2FA Flow)', () => {
  let controller: AuthController;
  let authService: AuthService;
  let jwtService: JwtService;

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
            findUserById: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('login', () => {
    it('should return requires_2fa and mfaToken if 2FA is enabled', async () => {
      const loginDto = { email: 'test@example.com', password: 'password' };
      const user = { id: 'user-id', twoFactorEnabled: true };

      (authService.validateUserWithFallback as jest.Mock).mockResolvedValue(user);
      (authService.generateMfaToken as jest.Mock).mockReturnValue('signed-mfa-token');

      const result = await controller.login(loginDto, { headers: {}, ip: '127.0.0.1' });

      expect(result).toEqual({
        requires_2fa: true,
        mfaToken: 'signed-mfa-token',
      });
      expect(authService.generateMfaToken).toHaveBeenCalledWith('user-id', null);
    });
  });

  describe('verify2fa', () => {
    it('should verify mfaToken and return login result', async () => {
      const verifyDto = { code: '123456', mfaToken: 'valid-mfa-token' };
      const payload = { sub: 'user-id', hotelId: 'hotel-id', purpose: 'mfa_verification' };
      const user = { id: 'user-id' };
      const loginResult = { access_token: 'access.token.here' };

      (jwtService.verify as jest.Mock).mockReturnValue(payload);
      (authService.findUserById as jest.Mock).mockResolvedValue(user);
      (authService.verify2FACode as jest.Mock).mockResolvedValue(true);
      (authService.login as jest.Mock).mockResolvedValue(loginResult);

      const result = await controller.verify2fa(verifyDto, { headers: {}, ip: '127.0.0.1' });

      expect(result).toBe(loginResult);
      expect(jwtService.verify).toHaveBeenCalledWith('valid-mfa-token');
      expect(authService.findUserById).toHaveBeenCalledWith('user-id');
      expect(authService.verify2FACode).toHaveBeenCalledWith('user-id', '123456');
      expect(authService.login).toHaveBeenCalledWith(user, 'hotel-id', expect.any(Object));
    });

    it('should throw UnauthorizedException if mfaToken purpose is invalid', async () => {
        const verifyDto = { code: '123456', mfaToken: 'invalid-purpose-token' };
        const payload = { sub: 'user-id', hotelId: 'hotel-id', purpose: 'wrong_purpose' };

        (jwtService.verify as jest.Mock).mockReturnValue(payload);

        await expect(controller.verify2fa(verifyDto, { headers: {}, ip: '127.0.0.1' }))
          .rejects.toThrow(UnauthorizedException);
      });

    it('should throw UnauthorizedException if mfaToken is invalid', async () => {
      const verifyDto = { code: '123456', mfaToken: 'invalid-mfa-token' };

      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(controller.verify2fa(verifyDto, { headers: {}, ip: '127.0.0.1' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});
