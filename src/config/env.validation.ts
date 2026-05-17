type EnvRecord = Record<string, string | undefined>;

function asOptionalString(env: EnvRecord, key: string): string | undefined {
  const value = env[key];
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  return value;
}

function asString(env: EnvRecord, key: string, fallback?: string): string {
  const value = env[key] ?? fallback;
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function asNumber(env: EnvRecord, key: string, fallback?: number): number {
  const raw =
    env[key] ?? (fallback !== undefined ? String(fallback) : undefined);
  if (raw === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return value;
}

function asBoolean(env: EnvRecord, key: string, fallback?: boolean): boolean {
  const raw =
    env[key] ?? (fallback !== undefined ? String(fallback) : undefined);
  if (raw === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  const normalized = raw.toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  throw new Error(`Environment variable ${key} must be a boolean`);
}

export function validateEnv(config: Record<string, unknown>) {
  const env = config as EnvRecord;
  const nodeEnv = asString(env, 'NODE_ENV', 'development');

  return {
    NODE_ENV: nodeEnv,
    PORT: asNumber(env, 'PORT', 3000),

    DB_HOST: asString(env, 'DB_HOST'),
    DB_PORT: asNumber(env, 'DB_PORT', 5432),
    DB_USERNAME: asString(env, 'DB_USERNAME'),
    DB_PASSWORD: asString(env, 'DB_PASSWORD'),
    DB_NAME: asString(env, 'DB_NAME'),
    DB_LOGGING: asBoolean(env, 'DB_LOGGING', nodeEnv !== 'production'),
    DB_SYNCHRONIZE: asBoolean(env, 'DB_SYNCHRONIZE', nodeEnv === 'development'),
    DB_SSL: asBoolean(env, 'DB_SSL', false),
    DB_POOL_SIZE: asNumber(env, 'DB_POOL_SIZE', 20),
    DB_RETRY_ATTEMPTS: asNumber(env, 'DB_RETRY_ATTEMPTS', 5),
    DB_RETRY_DELAY: asNumber(env, 'DB_RETRY_DELAY', 2000),
    DB_MAX_QUERY_EXECUTION_TIME: asNumber(
      env,
      'DB_MAX_QUERY_EXECUTION_TIME',
      5000,
    ),

    REDIS_HOST: asString(env, 'REDIS_HOST', 'localhost'),
    REDIS_PORT: asNumber(env, 'REDIS_PORT', 6379),
    REDIS_PASSWORD: env.REDIS_PASSWORD,
    REDIS_DB: asNumber(env, 'REDIS_DB', 0),
    REDIS_TLS: asBoolean(env, 'REDIS_TLS', false),

    JWT_SECRET: asString(env, 'JWT_SECRET'),
    JWT_EXPIRATION: asString(env, 'JWT_EXPIRATION', '900s'),
    REFRESH_TOKEN_SECRET: asString(env, 'REFRESH_TOKEN_SECRET'),
    REFRESH_TOKEN_EXPIRATION: asString(env, 'REFRESH_TOKEN_EXPIRATION', '7d'),

    WEBHOOK_SECRET: asString(env, 'WEBHOOK_SECRET'),

    OTEL_ENABLED: asBoolean(env, 'OTEL_ENABLED', false),
    OTEL_SERVICE_NAME: asString(
      env,
      'OTEL_SERVICE_NAME',
      'hotel-management-backend',
    ),
    OTEL_EXPORTER_OTLP_ENDPOINT: asOptionalString(
      env,
      'OTEL_EXPORTER_OTLP_ENDPOINT',
    ),

    S3_ENDPOINT: asOptionalString(env, 'S3_ENDPOINT'),
    S3_REGION: asString(env, 'S3_REGION', 'us-east-1'),
    S3_ACCESS_KEY: asOptionalString(env, 'S3_ACCESS_KEY'),
    S3_SECRET_KEY: asOptionalString(env, 'S3_SECRET_KEY'),
    S3_BUCKET: asOptionalString(env, 'S3_BUCKET'),
    S3_FORCE_PATH_STYLE: asBoolean(env, 'S3_FORCE_PATH_STYLE', true),
  };
}
