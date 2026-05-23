import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    // The payload contains the user_uuid, hotel_id, role, scope, and permissions
    return {
      userId: payload.sub,
      email: payload.email,
      hotelId: payload.hotel_id,
      hotel_id: payload.hotel_id,
      role: payload.role,
      scope: payload.scope,
      actorScope: payload.actor_scope,
      permissions: payload.permissions,
      supportAccessId: payload.support_access_id,
      isImpersonating: payload.is_impersonating,
    };
  }
}
