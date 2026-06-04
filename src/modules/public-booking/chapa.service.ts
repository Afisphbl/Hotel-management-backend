import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class ChapaService {
  private readonly baseUrl = 'https://api.chapa.co/v1';
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor(private config: ConfigService) {
    this.secretKey = this.config.getOrThrow<string>('CHAPA_SECRET_KEY');
    this.webhookSecret = this.config.get<string>('CHAPA_WEBHOOK_SECRET') || '';
  }

  async initiate(params: {
    amount: number;
    currency: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    txRef: string;
    returnUrl: string;
    callbackUrl: string;
    title: string;
    description?: string;
    meta?: Record<string, unknown>;
  }): Promise<{ checkoutUrl: string; txRef: string }> {
    const body: Record<string, unknown> = {
      amount: params.amount,
      currency: params.currency,
      email: params.email,
      first_name: params.firstName,
      last_name: params.lastName,
      tx_ref: params.txRef,
      return_url: params.returnUrl,
      callback_url: params.callbackUrl,
      customization: {
        title: params.title,
        description: params.description || '',
      },
    };

    if (params.phoneNumber) {
      body.phone_number = params.phoneNumber;
    }

    if (params.meta) {
      body.meta = params.meta;
    }

    const jsonBody = JSON.stringify(body);
    console.log(
      '[ChapaService] POST',
      `${this.baseUrl}/transaction/initialize`,
      {
        secretKeyPrefix: this.secretKey?.substring(0, 12) + '...',
        body,
      },
    );

    const res = await fetch(`${this.baseUrl}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log('[ChapaService] Response:', { status: res.status, data });

    if (data.status !== 'success') {
      throw new BadRequestException(`Chapa init failed: ${data.message}`);
    }
    return {
      checkoutUrl: data.data.checkout_url as string,
      txRef: params.txRef,
    };
  }

  async verify(
    txRef: string,
  ): Promise<{ status: string; amount: number; currency: string }> {
    const res = await fetch(`${this.baseUrl}/transaction/verify/${txRef}`, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    });
    const data = await res.json();
    return {
      status: data.data?.status ?? 'failed',
      amount: data.data?.amount ?? 0,
      currency: data.data?.currency ?? 'ETB',
    };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) return false;
    const hash = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');
    return hash === signature;
  }
}
