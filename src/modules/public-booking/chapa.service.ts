import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChapaService {
  private readonly baseUrl = 'https://api.chapa.co/v1';
  private readonly secretKey: string;

  constructor(private config: ConfigService) {
    this.secretKey = this.config.getOrThrow<string>('CHAPA_SECRET_KEY');
  }

  async initiate(params: {
    amount: number;
    currency: string;
    email: string;
    firstName: string;
    lastName: string;
    txRef: string;
    returnUrl: string;
    callbackUrl: string;
    title: string;
  }): Promise<string> {
    const res = await fetch(`${this.baseUrl}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency,
        email: params.email,
        first_name: params.firstName,
        last_name: params.lastName,
        tx_ref: params.txRef,
        return_url: params.returnUrl,
        callback_url: params.callbackUrl,
        title: params.title,
      }),
    });

    const data = await res.json();
    if (data.status !== 'success') {
      throw new BadRequestException(`Chapa init failed: ${data.message}`);
    }
    return data.data.checkout_url as string;
  }

  async verify(txRef: string): Promise<{ status: string; amount: number }> {
    const res = await fetch(`${this.baseUrl}/transaction/verify/${txRef}`, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    });
    const data = await res.json();
    return { status: data.data?.status ?? 'failed', amount: data.data?.amount ?? 0 };
  }
}
