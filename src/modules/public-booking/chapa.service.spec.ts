import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChapaService } from './chapa.service';
import * as crypto from 'crypto';

describe('ChapaService', () => {
  let service: ChapaService;
  let configService: ConfigService;

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'CHAPA_SECRET_KEY') return 'test_secret_key';
      return null;
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
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ChapaService>(ChapaService);
    configService = module.get<ConfigService>(ConfigService);
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifyWebhookSignature', () => {
    it('should return true for valid signature', () => {
      const payload = JSON.stringify({ event: 'charge.success' });
      const secret = 'test_webhook_secret';
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      expect(service.verifyWebhookSignature(payload, expectedSignature)).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const payload = JSON.stringify({ event: 'charge.success' });
      expect(service.verifyWebhookSignature(payload, 'invalid_signature')).toBe(false);
    });

    it('should return false if webhook secret is missing', () => {
      mockConfigService.get.mockReturnValueOnce(null);
      const serviceNoSecret = new ChapaService(configService as any);
      expect(serviceNoSecret.verifyWebhookSignature('{}', 'sig')).toBe(false);
    });
  });

  describe('PII Redaction', () => {
    it('should redact PII in initiate log', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          status: 200,
          json: () => Promise.resolve({ status: 'success', data: { checkout_url: 'http://test' } })
        })
      );

      await service.initiate({
        amount: 100,
        currency: 'ETB',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        txRef: 'ref',
        returnUrl: 'ret',
        callbackUrl: 'cb',
        title: 'Title'
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          body: expect.objectContaining({
            email: '***@***.***',
            first_name: '***',
            last_name: '***'
          })
        })
      );
      consoleSpy.mockRestore();
    });
  });

  describe('timeouts', () => {
    it('should pass signal to fetch in initiate', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        new Promise((resolve) => {
          // This promise doesn't resolve immediately
        })
      );

      const initiatePromise = service.initiate({
        amount: 100,
        currency: 'ETB',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        txRef: 'ref',
        returnUrl: 'ret',
        callbackUrl: 'cb',
        title: 'Title'
      });

      // Fetch should be called immediately
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );

      // Fast-forward 10 seconds
      jest.advanceTimersByTime(10001);

      // The signal should have aborted, and fetch (if it respects signal) or the promise should reject
      // In our mock fetch, it won't reject unless we make it.
      // But we've verified the signal is passed.
    });

    it('should pass signal to fetch in verify', async () => {
      global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));

      service.verify('ref');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });
});
