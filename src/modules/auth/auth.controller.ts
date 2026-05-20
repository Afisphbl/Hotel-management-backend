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
}

class Verify2faDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  tempToken?: string;
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

    // Check if 2FA is required for Platform users
    if (user.scope === UserScope.PLATFORM && !req.body.twoFactorCode) {
      // In a real app, we'd check if user has 2FA enabled or if it's mandatory
      // For now, let's signal that 2FA is needed
      return {
        requires_2fa: true,
        temp_token: 'temp_session_id_or_jwt', // In reality, a signed short-lived token
      };
    }

    const metadata = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      device: req.headers['user-agent']?.includes('Mobile')
        ? 'mobile'
        : 'desktop',
    };

    return this.authService.login(user, loginDto.hotelId, metadata);
  }

  @Post('verify-2fa')
  @HttpCode(HttpStatus.OK)
  async verify2fa(@Body() dto: Verify2faDto, @Request() req: any) {
    // 2FA verification logic here
    // If valid, proceed to login
    return { success: true, message: '2FA verified' };
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
    return this.authService.revokeRefreshToken(
      refreshTokenDto.refreshToken,
      userId,
    );
  }
}
