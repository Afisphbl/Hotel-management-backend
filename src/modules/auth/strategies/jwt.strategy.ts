import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (token) {
      const isRevoked = await this.redisService.get(`revoked_token:${token}`);
      if (isRevoked) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

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
