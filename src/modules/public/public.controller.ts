import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { PublicService } from './public.service';
import { GuestRegisterDto, GuestLoginDto } from './dto/guest-register.dto';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('hotels/by-subdomain/:subdomain')
  async getHotelBySubdomain(@Param('subdomain') subdomain: string) {
    return this.publicService.findHotelBySubdomain(subdomain);
  }

  @Post('auth/register')
  async register(@Body() dto: GuestRegisterDto) {
    return this.publicService.registerGuest(dto);
  }

  @Post('auth/login')
  async login(@Body() dto: GuestLoginDto) {
    return this.publicService.loginGuest(dto);
  }
}
