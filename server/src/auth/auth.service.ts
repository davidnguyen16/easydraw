import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService, 
    private jwtService: JwtService
) {}

    private issueToken(user: { id: string; email: string; name: string | null}) {
        const payload = { sub: user.id, email: user.email};
        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        };
    }

    async register(email: string, password: string, name?: string) {
        const existing = await this.prisma.user.findUnique({ where: { email } });
        
        if (existing) {
            throw new ConflictException('Email already in use');
        }
    
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await this.prisma.user.create({
            data: {
                email,
                passwordHash: hashedPassword,
                name,
        },
    });

        return this.issueToken(user);
    }

    async login(email: string, password: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
        throw new UnauthorizedException('Email or password is incorrect');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    
    if (!valid) {
        throw new UnauthorizedException('Email or password is incorrect');
    }

    return this.issueToken(user);
  }
}
