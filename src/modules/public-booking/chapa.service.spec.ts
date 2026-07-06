import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChapaService } from './chapa.service';
import * as crypto from 'crypto';

describe('ChapaService', () => {
  let service: ChapaService;

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'CHAPA_SECRET_KEY') return 'test_secret_key';
      throw new Error(`Unexpected key: ${key}`);
    }),
    get: jest.fn((key: string) => {
      if (key === 'CHAPA_WEBHOOK_SECRET') return 'test_webhook_secret';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChapaService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ChapaService>(ChapaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifyWebhookSignature', () => {
    const payload = JSON.stringify({ event: 'test.event', data: {} });
    const secret = 'test_webhook_secret';
    const validHash = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    it('should return true for a valid signature', () => {
      const result = service.verifyWebhookSignature(payload, validHash);
      expect(result).toBe(true);
    });

    it('should return false for an invalid signature', () => {
      const invalidHash = 'wrong_hash';
      const result = service.verifyWebhookSignature(payload, invalidHash);
      expect(result).toBe(false);
    });

    it('should return false for a signature with incorrect length', () => {
      const shortHash = 'abc';
      const result = service.verifyWebhookSignature(payload, shortHash);
      expect(result).toBe(false);
    });

    it('should return false if signature is missing', () => {
      const result = service.verifyWebhookSignature(payload, undefined as any);
      expect(result).toBe(false);
    });

    it('should return false when webhook secret is not configured', () => {
      mockConfigService.get.mockReturnValueOnce('');
      const localService = new ChapaService(mockConfigService as any);
      const result = localService.verifyWebhookSignature(payload, validHash);
      expect(result).toBe(false);
    });
  });
});
