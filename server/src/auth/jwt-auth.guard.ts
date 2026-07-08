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
        const header = request.headers.authorization;

        if (!header || !header.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing token');
        }
        
        try {
            const payload = this.jwtService.verify<JwtPayload>(header.slice(7));
            request.user = payload;
            return true;
        } catch (error) {
            throw new UnauthorizedException('Invalid token');
        }
    }
}