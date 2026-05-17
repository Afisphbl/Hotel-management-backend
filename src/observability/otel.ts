import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

let sdk: NodeSDK | null = null;

function envBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  const normalized = value.toLowerCase();
  return ['true', '1', 'yes', 'y'].includes(normalized);
}

export async function startOpenTelemetry(): Promise<void> {
  if (!envBool(process.env.OTEL_ENABLED, false) || sdk) {
    return;
  }

  const traceExporter = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      })
    : undefined;

  sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || 'hotel-management-backend',
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
}

export async function stopOpenTelemetry(): Promise<void> {
  if (!sdk) {
    return;
  }
  await sdk.shutdown();
  sdk = null;
}
