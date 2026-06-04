import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { PublicService } from './public.service';
import { GuestRegisterDto, GuestLoginDto } from './dto/guest-register.dto';
import { UpdateGuestProfileDto } from './dto/public-operations.dto';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('hotels/by-subdomain/:subdomain')
  async getHotelBySubdomain(@Param('subdomain') subdomain: string) {
    return this.publicService.findHotelBySubdomain(subdomain);
  }

  @Get('hotels/by-id/:id')
  async getHotelById(@Param('id') id: string) {
    return this.publicService.findHotelById(id);
  }

  @Post('auth/register')
  async register(@Body() dto: GuestRegisterDto) {
    return this.publicService.registerGuest(dto);
  }

  @Post('auth/login')
  async login(@Body() dto: GuestLoginDto) {
    return this.publicService.loginGuest(dto);
  }

  @Get('auth/me')
  async me(@Headers('authorization') authorization: string) {
    if (!authorization)
      throw new UnauthorizedException('Missing authorization header');
    const token = authorization.replace('Bearer ', '');
    return this.publicService.getMe(token);
  }

  @Get('auth/bookings')
  async myBookings(@Headers('authorization') authorization: string) {
    if (!authorization)
      throw new UnauthorizedException('Missing authorization header');
    const token = authorization.replace('Bearer ', '');
    return this.publicService.getMyBookings(token);
  }

  @Patch('auth/me')
  async updateMe(
    @Headers('authorization') authorization: string,
    @Body() dto: UpdateGuestProfileDto,
  ) {
    if (!authorization)
      throw new UnauthorizedException('Missing authorization header');
    const token = authorization.replace('Bearer ', '');
    return this.publicService.updateMe(token, dto);
  }
}
