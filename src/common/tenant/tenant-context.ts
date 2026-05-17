import { AsyncLocalStorage } from 'node:async_hooks';

type TenantStore = {
  schema: string;
};

const tenantStorage = new AsyncLocalStorage<TenantStore>();

export function runWithTenantSchema<T>(schema: string, callback: () => T): T {
  return tenantStorage.run({ schema }, callback);
}

export function getTenantSchema(): string {
  return tenantStorage.getStore()?.schema ?? 'global';
}
