import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  Redirect,
  BadRequestException,
} from '@nestjs/common';
import { PublicBookingService } from './public-booking.service';
import { CreatePublicBookingDto } from './dto/public-booking.dto';

@Controller('public/bookings')
export class PublicBookingController {
  constructor(private readonly publicBookingService: PublicBookingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePublicBookingDto,
    @Headers('x-hotel-id') hotelId: string,
  ) {
    if (!hotelId)
      throw new BadRequestException('x-hotel-id header is required');

    return this.publicBookingService.createPublicBooking({
      hotelId,
      roomId: dto.roomId,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      numGuests: dto.numGuests,
      notes: dto.notes,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phoneNumber: dto.phoneNumber,
    });
  }

  @Get(':id/return/:hotelId')
  @Redirect()
  async handleReturn(
    @Param('id') id: string,
    @Param('hotelId') hotelId: string,
    @Query('tx_ref') txRef: string,
  ) {
    if (!hotelId)
      throw new BadRequestException('hotelId path parameter is required');
    const result = await this.publicBookingService.handlePaymentReturn(
      id,
      txRef,
      hotelId,
    );
    const frontendUrl = this.publicBookingService.getFrontendUrl();
    const status = result.status === 'success' ? 'success' : 'failed';
    const url = `${frontendUrl}/cabins?payment=${status}&booking=${id}`;
    return { url, statusCode: 302 };
  }

  @Get('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhookGet(
    @Query('trx_ref') txRef: string,
    @Query('status') status: string,
    @Query('callback') callback: string,
  ) {
    if (!txRef)
      throw new BadRequestException('trx_ref query parameter is required');
    await this.publicBookingService.handleJSONPCallback(txRef, status);
    if (callback) {
      return `${callback}(${JSON.stringify({ status: 'ok' })})`;
    }
    return { received: true };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: any,
    @Headers('x-chapa-signature') signature: string,
    @Headers('chapa-signature') altSignature: string,
  ) {
    const sig = signature || altSignature;
    if (!sig) throw new BadRequestException('Missing webhook signature');
    return this.publicBookingService.handleWebhook(body, sig);
  }

  @Get(':id')
  async getStatus(@Param('id') id: string) {
    return this.publicBookingService.getBookingStatus(id);
  }
}
