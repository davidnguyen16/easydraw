import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface JwtPayload {
    sub: string;
    email: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private jwtService: JwtService) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();

        const cookieToken = request.cookies?.access_token as string | undefined;
        const header = request.headers.authorization;
        const bearerToken = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
        const token = cookieToken ?? bearerToken;

        if (!token) {
            throw new UnauthorizedException('Missing token');
        }
        
        try {
            request.user = this.jwtService.verify<JwtPayload>(token);
            return true;
        } catch {
            throw new UnauthorizedException('Invalid or Expired token');
        }
    }
}