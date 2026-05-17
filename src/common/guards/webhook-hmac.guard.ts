import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class WebhookHmacGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['x-webhook-signature'];
    const timestamp = request.headers['x-webhook-timestamp'];
    const body = JSON.stringify(request.body);

    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    if (!timestamp) {
      throw new UnauthorizedException('Missing webhook timestamp');
    }

    // Check timestamp is within 5 minutes to prevent replay attacks
    const webhookTime = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(now - webhookTime);

    if (timeDiff > 300) { // 5 minutes
      throw new UnauthorizedException('Webhook timestamp too old');
    }

    // Verify HMAC signature
    const webhookSecret = this.configService.get<string>('WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new UnauthorizedException('Webhook secret not configured');
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    if (!this.timingSafeEqual(signature, expectedSignature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }

  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}
