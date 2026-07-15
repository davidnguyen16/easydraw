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

    private issueToken(user: { 
        id: string; 
        email: string; 
        name: string | null
        createdAt: Date;
    }) {
        const payload = { 
            sub: user.id, 
            email: user.email};
        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                createdAt: user.createdAt,
            },
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

    async validateGoogleUser(profile: { googleId: string; email: string; name?: string}) {
        // Have logined with Google before -> Find by Google ID
        let user = await this.prisma.user.findUnique({
            where: { googleId: profile.googleId },
        });

        if (user) return this.issueToken(user);

        // Have registered with Email account before -> Update googleId to existed account 
        const existing = await this.prisma.user.findUnique({
            where: { email: profile.email },
        });

        if (existing) {
            user = await this.prisma.user.update({
                where: { id: existing.id },
                data: { googleId: profile.googleId },
            });
            return this.issueToken(user);
        }

        // New User - First time login with Google -> Create account (no passwordHash because login with Google)
        user = await this.prisma.user.create({
            data: {
                email: profile.email,
                googleId: profile.googleId,
                name: profile.name,
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

    async me(userId: string) {
        const user = await this.prisma.user.findUnique({ 
            where: { id: userId }
        });
        
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        return { 
            id: user.id, 
            email: user.email, 
            name: user.name,
            createdAt: user.createdAt,
        };
    }

    async deleteAccount(userId: string) {
        await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { id: true },
            });

            if (!user) {
                throw new UnauthorizedException('User not found');
            }

            await tx.diagram.deleteMany({
                where: { ownerId: userId},
            });

            await tx.user.delete({
                where: { id: userId },
            });
        });
    }
}
