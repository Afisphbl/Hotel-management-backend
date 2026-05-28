import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
  SetMetadata,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';
import { IsNotEmpty, IsString, IsUUID, IsOptional } from 'class-validator';

class RefreshTokenDto {
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}

class ImpersonateDto {
  @IsNotEmpty()
  @IsUUID()
  hotelId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

class Verify2faDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsString()
  mfaToken: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Request() req: any) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    let hotelId = loginDto.hotelId;

    if (loginDto.domain && !hotelId) {
      // Find hotel by subdomain if domain is provided
      const hotel = await this.authService.findHotelBySubdomain(loginDto.domain);
      if (hotel) {
        hotelId = hotel.id;
      }
    }

    // Check if 2FA is required for users
    if (user.twoFactorEnabled && !loginDto.twoFactorCode) {
      const mfaToken = await this.authService.generateMfaToken(user.id);
      return {
        requires_2fa: true,
        mfaToken,
      };
    }

    if (user.twoFactorEnabled && loginDto.twoFactorCode) {
      await this.authService.verify2FACode(user.id, loginDto.twoFactorCode);
    }

    const metadata = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      device: req.headers['user-agent']?.includes('Mobile')
        ? 'mobile'
        : 'desktop',
    };

    const result = await this.authService.login(user, hotelId, metadata);
    const tokenPayload = JSON.parse(
      Buffer.from(result.access_token.split('.')[1], 'base64url').toString(),
    );
    console.log('=== LOGIN ===', {
      ...tokenPayload,
      access_token: result.access_token.slice(0, 20) + '...',
    });
    return result;
  }

  @Post('setup-2fa')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async setup2fa(@Request() req: any) {
    return this.authService.generate2FASecret(req.user.userId);
  }

  @Post('activate-2fa')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async activate2fa(@Body() body: { secret: string; code: string }, @Request() req: any) {
    return this.authService.verify2FASetup(req.user.userId, body.secret, body.code);
  }

  @Post('verify-2fa')
  @HttpCode(HttpStatus.OK)
  async verify2fa(@Body() dto: Verify2faDto, @Request() req: any) {
    // This is used for the second step of login if requires_2fa was returned
    const userId = await this.authService.verifyMfaToken(dto.mfaToken);
    const user = await this.authService.findUserById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    await this.authService.verify2FACode(user.id, dto.code);

    const metadata = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };

    return this.authService.login(user, null, metadata);
  }

  @Post('impersonate')
  @UseGuards(JwtAuthGuard, ScopeGuard, PermissionsGuard)
  @Scopes(UserScope.PLATFORM)
  @SetMetadata('permissions', ['platform:impersonate'])
  @HttpCode(HttpStatus.OK)
  async impersonate(@Body() dto: ImpersonateDto, @Request() req: any) {
    const user = req.user;
    
    const metadata = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      device: 'impersonation-session',
      supportReason: dto.reason,
    };

    // Create a login session for the target hotel with impersonation flag
    return this.authService.login(user, dto.hotelId, metadata, true);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto, @Request() req: any) {
    const metadata = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };
    return this.authService.refreshTokens(
      refreshTokenDto.refreshToken,
      metadata,
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Body() refreshTokenDto: RefreshTokenDto, @Request() req: any) {
    const userId = req.user.userId;
    const result = await this.authService.revokeRefreshToken(
      refreshTokenDto.refreshToken,
      userId,
    );
    if (req.user.supportAccessId) {
      await this.authService.revokeSupportAccess(req.user.supportAccessId);
    }
    return result;
  }
}
