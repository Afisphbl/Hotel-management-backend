export interface JWTPayload {
  sub: string;
  hotel_id?: string;
  role: string;
  scope: 'PLATFORM' | 'HOTEL';
  permissions: string[];
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  token_version: number;
  iat: number;
  exp: number;
}