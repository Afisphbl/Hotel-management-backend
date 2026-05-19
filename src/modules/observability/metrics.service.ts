import { Injectable } from '@nestjs/common';
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
  register,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  private readonly httpRequestDurationSeconds: Histogram<string>;
  private readonly httpRequestTotal: Counter<string>;

  constructor() {
    this.registry = register;

    if (
      !this.registry.getSingleMetric(
        'hotel_mgmt_process_cpu_user_seconds_total',
      )
    ) {
      collectDefaultMetrics({
        register: this.registry,
        prefix: 'hotel_mgmt_',
      });
    }

    this.httpRequestDurationSeconds =
      (this.registry.getSingleMetric(
        'hotel_mgmt_http_request_duration_seconds',
      ) as Histogram<string>) ||
      new Histogram({
        name: 'hotel_mgmt_http_request_duration_seconds',
        help: 'HTTP request duration in seconds',
        labelNames: ['method', 'route', 'status_code'] as const,
        buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
        registers: [this.registry],
      });

    this.httpRequestTotal =
      (this.registry.getSingleMetric(
        'hotel_mgmt_http_requests_total',
      ) as Counter<string>) ||
      new Counter({
        name: 'hotel_mgmt_http_requests_total',
        help: 'Total count of HTTP requests',
        labelNames: ['method', 'route', 'status_code'] as const,
        registers: [this.registry],
      });
  }

  observeHttpRequest(labels: {
    method: string;
    route: string;
    statusCode: number;
    durationSeconds: number;
  }): void {
    const metricLabels = {
      method: labels.method,
      route: labels.route,
      status_code: String(labels.statusCode),
    };

    this.httpRequestDurationSeconds.observe(
      metricLabels,
      labels.durationSeconds,
    );
    this.httpRequestTotal.inc(metricLabels);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
