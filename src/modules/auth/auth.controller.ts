import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

class RefreshTokenDto {
  refreshToken: string;
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

    const metadata = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      device: req.headers['user-agent']?.includes('Mobile')
        ? 'mobile'
        : 'desktop',
    };

    return this.authService.login(user, loginDto.hotelId, metadata);
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
