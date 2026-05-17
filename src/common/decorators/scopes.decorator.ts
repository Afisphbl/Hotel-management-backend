import { SetMetadata } from '@nestjs/common';
import { UserScope } from '../../database/entities/user.entity';

export const SCOPES_KEY = 'scopes';
export const Scopes = (...scopes: UserScope[]) =>
  SetMetadata(SCOPES_KEY, scopes);
