import { SetMetadata } from '@nestjs/common';

export type PlanLimitResource = 'rooms' | 'users' | 'storage';

export const PLAN_LIMIT_KEY = 'plan_limit_resource';

export const PlanLimit = (resource: PlanLimitResource) =>
  SetMetadata(PLAN_LIMIT_KEY, resource);
