import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Hotel } from '../../database/entities/hotel.entity';
import { ChapaService } from './chapa.service';
import { runWithTenantSchema } from '../../common/tenant/tenant-context';

@Injectable()
export class PublicBookingService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    private chapaService: ChapaService,
    private config: ConfigService,
  ) {}

  getFrontendUrl(): string {
    return this.config.get('FRONTEND_URL', 'http://abdures.localhost:3000');
  }

  private async getSchema(hotelId: string): Promise<string> {
    const hotel = await this.hotelRepository.findOne({ where: { id: hotelId } });
    if (!hotel) throw new NotFoundException('Hotel not found');
    return hotel.schemaName?.replace(/[^a-zA-Z0-9_]/g, '') ?? 'public';
  }

  private getDatesBetween(start: string, end: string): string[] {
    const dates: string[] = [];
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em, ed] = end.split('-').map(Number);
    const current = new Date(sy, sm - 1, sd);
    const last = new Date(ey, em - 1, ed);
    while (current < last) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 1);
    }
    console.log('[getDatesBetween]', { start, end, dates });
    return dates;
  }

  async createPublicBooking(dto: {
    hotelId: string;
    roomId: string;
    checkIn: string;
    checkOut: string;
    numGuests: number;
    notes?: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
  }) {
    console.log('[createPublicBooking] Input:', { checkIn: dto.checkIn, checkOut: dto.checkOut });
    const schema = await this.getSchema(dto.hotelId);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const roomRows = await queryRunner.query(
        `SELECT r.id, r."roomNumber", r."hotelId", r."roomTypeId",
                r."basePrice", r."baseCapacity", r.status,
                rt.id AS rt_id, rt.name AS rt_name, rt."basePrice" AS rt_basePrice
         FROM "${schema}"."rooms" r
         LEFT JOIN "${schema}"."room_types" rt ON rt.id = r."roomTypeId" AND rt."deletedAt" IS NULL
         WHERE r.id = $1 AND r."deletedAt" IS NULL
         LIMIT 1`,
        [dto.roomId],
      );
      if (!roomRows.length) throw new NotFoundException('Room not found');
      const roomRow = roomRows[0];

      let guestId = '';
      const existingGuest = await queryRunner.query(
        `SELECT id FROM "${schema}"."guests" WHERE email = $1 AND "deletedAt" IS NULL LIMIT 1`,
        [dto.email],
      );

      if (existingGuest.length) {
        guestId = existingGuest[0].id;
      } else {
        const newGuest = await queryRunner.query(
          `INSERT INTO "${schema}"."guests" ("firstName", "lastName", "email", "phone")
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [dto.firstName, dto.lastName, dto.email, dto.phoneNumber || null],
        );
        guestId = newGuest[0].id;
      }

      const dates = this.getDatesBetween(dto.checkIn, dto.checkOut);
      if (dates.length === 0) {
        throw new BadRequestException('Check-out must be after check-in');
      }

      const conflictingNights = await queryRunner.query(
        `SELECT id, date, status FROM "${schema}"."room_nights"
         WHERE "roomId" = $1 AND date = ANY($2)
         AND status IN ('held', 'booked')
         LIMIT 1`,
        [dto.roomId, dates],
      );
      if (conflictingNights.length > 0) {
        console.log('[Conflict] Room', roomRow.roomNumber, 'not available for dates', dates, '- conflicting:', conflictingNights);
        throw new ConflictException('Room is not available for selected dates');
      }

      const basePrice = Number(roomRow.basePrice || roomRow.rt_basePrice || 0);
      const totalPrice = basePrice * dates.length;

      const bookingResult = await queryRunner.query(
        `INSERT INTO "${schema}"."bookings"
         ("guestId", "checkIn", "checkOut", "status", "totalPrice", "idempotencyKey", "source", "notes", "numGuests", "priceSnapshot")
         VALUES ($1, $2, $3, 'pending', $4, $5, 'public', $6, $7, $8)
         RETURNING id`,
        [
          guestId,
          `${dto.checkIn}T12:00:00`,
          `${dto.checkOut}T12:00:00`,
          totalPrice,
          `${dto.hotelId}_${dto.roomId}_${dto.checkIn}_${dto.checkOut}_${Date.now()}`,
          dto.notes || null,
          dto.numGuests,
          JSON.stringify({
            roomTypeId: roomRow.roomTypeId,
            roomNumber: roomRow.roomNumber,
            basePrice,
            nights: dates.map((date: string) => ({ date, price: basePrice })),
            pricingDate: new Date().toISOString(),
          }),
        ],
      );
      const bookingId = bookingResult[0].id;

      for (const date of dates) {
        await queryRunner.query(
          `INSERT INTO "${schema}"."room_nights" ("roomId", "date", "status", "price", "bookingId")
           VALUES ($1, $2, 'held', $3, $4)`,
          [dto.roomId, date, basePrice, bookingId],
        );
      }

      await queryRunner.query(
        `INSERT INTO "${schema}"."booking_rooms" ("bookingId", "roomId", "roomTypeId", "price", "nightPrices")
         VALUES ($1, $2, $3, $4, $5)`,
        [
          bookingId,
          dto.roomId,
          roomRow.roomTypeId,
          totalPrice,
          JSON.stringify(dates.map((date: string) => ({ date, price: basePrice }))),
        ],
      );

      const invoiceResult = await queryRunner.query(
        `INSERT INTO "${schema}"."invoices"
         ("bookingId", "amount", "subtotal", "taxTotal", "currency", "status", "lineItems")
         VALUES ($1, $2, $3, 0, 'ETB', 'draft', $4)
         RETURNING id`,
        [
          bookingId,
          totalPrice,
          totalPrice,
          JSON.stringify([{
            description: `${roomRow.roomNumber} x ${dates.length} nights`,
            quantity: dates.length,
            unitPrice: basePrice,
            total: totalPrice,
          }]),
        ],
      );
      const invoiceId = invoiceResult[0].id;

      const paymentResult = await queryRunner.query(
        `INSERT INTO "${schema}"."payments"
         ("invoiceId", "bookingId", "amount", "fee", "netAmount", "currency", "method", "status", "description")
         VALUES ($1, $2, $3, 0, $4, 'ETB', 'mobile_payment', 'pending', $5)
         RETURNING id`,
        [invoiceId, bookingId, totalPrice, totalPrice, `Booking ${bookingId} - ${roomRow.roomNumber}`],
      );
      const paymentId = paymentResult[0].id;

      const backofficeUrl = this.config.get('BACKOFFICE_URL', 'http://localhost:5000');
      const rand = Math.random().toString(36).substring(2, 6);
      const txRef = `TX${Date.now()}${rand}`;

      console.log('[Chapa] Initiating payment:', { amount: totalPrice, currency: 'ETB', email: dto.email, txRef });
      const { checkoutUrl } = await this.chapaService.initiate({
        amount: totalPrice,
        currency: 'ETB',
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
        txRef,
        returnUrl: `${backofficeUrl}/api/v1/public/bookings/${bookingId}/return/${dto.hotelId}?tx_ref=${txRef}`,
        callbackUrl: `${backofficeUrl}/api/v1/public/bookings/webhook`,
        title: `Booking ${roomRow.roomNumber}`,
        description: `Booking ${roomRow.roomNumber}`,
        meta: {
          bookingId,
          invoiceId,
          paymentId,
          roomNumber: roomRow.roomNumber,
          hotelId: dto.hotelId,
          schemaName: schema,
        },
      });
      console.log('[Chapa] Payment initiated successfully:', { checkoutUrl });

      await queryRunner.query(
        `UPDATE "${schema}"."payments" SET "transactionId" = $1, "gatewayResponse" = $2 WHERE id = $3`,
        [txRef, JSON.stringify({ checkoutUrl }), paymentId],
      );

      await queryRunner.commitTransaction();

      return { bookingId, checkoutUrl, txRef, totalPrice };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async handlePaymentReturn(bookingId: string, txRef: string, hotelId: string) {
    const schema = await this.getSchema(hotelId);
    return runWithTenantSchema(schema, async () => {
      const verification = await this.chapaService.verify(txRef);
      if (verification.status === 'success') {
        await this.confirmBooking(bookingId, txRef, verification);
        return { status: 'success', bookingId };
      }
      await this.cancelBooking(bookingId);
      return { status: verification.status, bookingId };
    });
  }

  async handleJSONPCallback(txRef: string, status: string) {
    // JSONP callback is best-effort; the return handler does the actual confirmation
    console.log('[Chapa] JSONP callback received:', { txRef, status });
  }

  async handleWebhook(payload: any, signature: string) {
    const rawPayload = JSON.stringify(payload);
    if (!this.chapaService.verifyWebhookSignature(rawPayload, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }
    if (payload.event === 'charge.success') {
      const txRef = payload.tx_ref;
      const verification = await this.chapaService.verify(txRef);
      if (verification.status === 'success') {
        const bookingId = payload.meta?.bookingId;
        const hotelId = payload.meta?.hotelId;
        if (bookingId && hotelId) {
          const schema = payload.meta?.schemaName || await this.getSchema(hotelId);
          await runWithTenantSchema(schema, () =>
            this.confirmBooking(bookingId, txRef, verification),
          );
        }
      }
    }
    return { received: true };
  }

  private async confirmBooking(
    bookingId: string,
    txRef: string,
    verification: { status: string; amount: number; currency: string },
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const bookingRows = await queryRunner.query(
        `SELECT id, status FROM bookings WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
        [bookingId],
      );
      if (!bookingRows.length) throw new NotFoundException('Booking not found');
      if (bookingRows[0].status === 'confirmed') return;
      if (bookingRows[0].status !== 'pending' && bookingRows[0].status !== 'hold') {
        throw new BadRequestException(`Cannot confirm booking in status: ${bookingRows[0].status}`);
      }

      await queryRunner.query(
        `UPDATE bookings SET status = 'confirmed' WHERE id = $1`,
        [bookingId],
      );

      await queryRunner.query(
        `UPDATE room_nights SET status = 'booked' WHERE "bookingId" = $1 AND status = 'held'`,
        [bookingId],
      );

      const paymentRows = await queryRunner.query(
        `SELECT id, "invoiceId" FROM payments WHERE "bookingId" = $1 LIMIT 1`,
        [bookingId],
      );

      if (paymentRows.length) {
        const { id: paymentId, invoiceId } = paymentRows[0];
        await queryRunner.query(
          `UPDATE payments SET status = 'completed', "transactionId" = $1, "gatewayResponse" = $2, "paidAt" = NOW() WHERE id = $3`,
          [txRef, JSON.stringify(verification), paymentId],
        );

        if (invoiceId) {
          await queryRunner.query(
            `UPDATE invoices SET status = 'paid', "paidAt" = NOW() WHERE id = $1`,
            [invoiceId],
          );
        }
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async cancelBooking(bookingId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const bookingRows = await queryRunner.query(
        `SELECT id, status FROM bookings WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1`,
        [bookingId],
      );
      if (!bookingRows.length) throw new NotFoundException('Booking not found');
      if (bookingRows[0].status === 'cancelled') return;

      await queryRunner.query(
        `UPDATE bookings SET status = 'cancelled' WHERE id = $1`,
        [bookingId],
      );

      await queryRunner.query(
        `DELETE FROM room_nights WHERE "bookingId" = $1`,
        [bookingId],
      );

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getBookingStatus(bookingId: string) {
    const rows = await this.dataSource.query(
      `SELECT b.id, b.status, b."checkIn", b."checkOut", b."totalPrice",
              g."firstName", g."lastName", g.email
       FROM bookings b
       LEFT JOIN guests g ON g.id = b."guestId"
       WHERE b.id = $1 AND b."deletedAt" IS NULL
       LIMIT 1`,
      [bookingId],
    );
    if (!rows.length) throw new NotFoundException('Booking not found');
    return {
      id: rows[0].id,
      status: rows[0].status,
      checkIn: rows[0].checkIn,
      checkOut: rows[0].checkOut,
      totalPrice: rows[0].totalPrice,
      guest: {
        firstName: rows[0].firstName,
        lastName: rows[0].lastName,
        email: rows[0].email,
      },
    };
  }
}