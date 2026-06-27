import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController MFA Secured', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    findUserById: jest.fn(),
    verify2FACode: jest.fn(),
    login: jest.fn(),
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

  it('should identify user via mfaToken in verify2fa', async () => {
    const userId = 'user-123';
    const hotelId = 'hotel-456';
    const code = '123456';
    const mfaToken = 'valid-mfa-token';
    const mockUser = { id: userId, email: 'user@example.com' };

    mockAuthService.verifyMfaToken.mockReturnValue({ userId, hotelId });
    mockAuthService.findUserById.mockResolvedValue(mockUser);
    mockAuthService.verify2FACode.mockResolvedValue(true);
    mockAuthService.login.mockResolvedValue({ access_token: 'final-token' });

    const result = await controller.verify2fa(
      { mfaToken, code },
      { headers: {}, ip: '127.0.0.1' },
    );

    expect(authService.verifyMfaToken).toHaveBeenCalledWith(mfaToken);
    expect(authService.findUserById).toHaveBeenCalledWith(userId);
    expect(authService.verify2FACode).toHaveBeenCalledWith(mockUser, code);
    expect(authService.login).toHaveBeenCalledWith(mockUser, hotelId, expect.any(Object));
    expect(result).toEqual({ access_token: 'final-token' });
  });

  it('should throw UnauthorizedException if mfaToken is invalid', async () => {
    mockAuthService.verifyMfaToken.mockImplementation(() => {
      throw new UnauthorizedException('Invalid or expired MFA token');
    });

    await expect(
      controller.verify2fa(
        { mfaToken: 'invalid', code: '123456' },
        { headers: {}, ip: '127.0.0.1' },
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});
