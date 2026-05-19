import { SetMetadata } from '@nestjs/common';
import { SCOPE_KEY, PLATFORM_SCOPE, HOTEL_SCOPE } from '../guards/scope.guard';

export const RequireScope = (
  scope: typeof PLATFORM_SCOPE | typeof HOTEL_SCOPE,
) => SetMetadata(SCOPE_KEY, scope);
