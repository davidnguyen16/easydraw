import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard, type JwtPayload } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { Throttle } from '@nestjs/throttler';
import { userInfo } from 'node:os';

@Controller('auth')
export class AuthController {
    constructor (private readonly authService: AuthService) {}

    @Throttle({ default: { limit: 10, ttl: 60000 } })
    @Post('register')
    async register(@Body() body: RegisterDto, @Res({ passthrough: true }) res: Response) {
            const result = await this.authService.register(body.email, body.password, body.name);
            this.setTokenCookie(res, result.access_token);
            return result;
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

    @Throttle({ default: { limit: 10, ttl: 60000 } })
    @Post('login')
    @HttpCode(HttpStatus.OK)
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

    @UseGuards(JwtAuthGuard)
    @Get('me')
    me(@CurrentUser() user: JwtPayload) {
        return this.authService.me(user.sub);
    }
    
    @Throttle({ default: { limit: 3, ttl: 60000 } })
    @UseGuards(JwtAuthGuard)
    @Delete('account')
    async deleteAccount(
        @CurrentUser() user: JwtPayload,
        @Res({ passthrough: true }) res: Response,
    ) {
        await this.authService.deleteAccount(user.sub);
        res.clearCookie('access_token');
        return { deleted: true};
    }

    // ROUTE 1 - kick off the flow. Guard redirects to Google; body never runs.
    @Get('google')
    @UseGuards(AuthGuard('google'))
    googleAuth() {}

    // ROUTE 2 - Google redirects back with ?code=...
    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    googleCallback(@Req() req: Request, @Res() res: Response) {
        // validate() returned { access_token, user } -> Pasport put it on req.user
        const { access_token } = req.user as unknown as { access_token: string };
        this.setTokenCookie(res, access_token);
        return res.redirect('http://localhost:5173/dashboard');
    }
}
