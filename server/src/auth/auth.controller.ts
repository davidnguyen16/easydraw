import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
    constructor (private readonly authService: AuthService) {}

    @Post('register')
    register(@Body() body: RegisterDto) {
        return this.authService.register(body.email, body.password, body.name);
    }

    // Apply token to cookie httpOnly - Browser keeps, JS cannot read
    private setTokenCookie(res: Response, token: string) {
        res.cookie('access_token', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
    }

    @Post('login')
    async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
        const result = await this.authService.login(body.email, body.password);
        this.setTokenCookie(res, result.access_token);
        return result;
    }

    @Post('logout') 
    logout(@Res({ passthrough: true }) res: Response) {
        res.clearCookie('access_token');
        return { loggedOut: true };
    }
}
