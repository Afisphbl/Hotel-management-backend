import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GlobalSetting, SettingCategory } from '../../database/entities/global/global-setting.entity';

export interface PaymentGatewayConfig {
  provider: string;
  mode?: 'test' | 'live';
  endpoint?: string;
  publicKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  additionalSettings?: Record<string, any>;
}

@Injectable()
export class PaymentGatewayService {
  constructor(private readonly dataSource: DataSource) {}

  async getConfig(): Promise<PaymentGatewayConfig | null> {
    const setting = await this.dataSource.getRepository(GlobalSetting).findOne({
      where: { key: 'payment_gateway:config' },
    });
    return (setting?.value as PaymentGatewayConfig | null) ?? null;
  }

  async updateConfig(config: PaymentGatewayConfig): Promise<PaymentGatewayConfig> {
    if (!config.provider) {
      throw new BadRequestException('Payment gateway provider is required');
    }
    const repository = this.dataSource.getRepository(GlobalSetting);
    let setting = await repository.findOne({ where: { key: 'payment_gateway:config' } });
    if (setting) {
      setting.value = config;
    } else {
      setting = repository.create({
        key: 'payment_gateway:config',
        value: config,
        category: SettingCategory.PAYMENT_GATEWAY,
        description: 'Payment gateway configuration',
      });
    }
    await repository.save(setting);
    return config;
  }

  async buildGatewayResponse(input: {
    paymentId: string;
    amount: number;
    currency: string;
    method: string;
    transactionId?: string;
  }) {
    const config = await this.getConfig();
    if (!config) {
      return {
        provider: 'manual',
        status: 'captured',
        reference: input.transactionId ?? input.paymentId,
        amount: input.amount,
        currency: input.currency,
        method: input.method,
      };
    }

    return {
      provider: config.provider,
      mode: config.mode ?? 'test',
      status: 'captured',
      reference: input.transactionId ?? `${config.provider}-${input.paymentId}`,
      endpoint: config.endpoint ?? null,
      amount: input.amount,
      currency: input.currency,
      method: input.method,
    };
  }
}
