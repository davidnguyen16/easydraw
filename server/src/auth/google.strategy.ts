import { Injectable } from '@nestjs/common';
import { PassportStrategy } from  '@nestjs/passport';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(private readonly authService: AuthService) {
        super({
            clientID: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            callbackURL: process.env.GOOGLE_REDIRECT_URI!,
            scope: ['email', 'profile'],
        });
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: VerifyCallback,
    ) {
        const result = await this.authService.validateGoogleUser({
            googleId: profile.id,
            email: profile.emails?.[0]?.value ?? '',
            name: profile.displayName,
        });
        done(null, result);
    }
}