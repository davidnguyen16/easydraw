import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import {
  SESSION_COOKIE,
  SessionAuthGuard,
  sessionTokenFrom,
  type AuthUser,
} from './session-auth.guard';
import { SessionService } from './session.service';
import { CurrentUser } from './current-user.decorator';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { RequireTrustedOrigin } from './trusted-origin.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessions: SessionService,
  ) {}

  private get cookieOptions() {
    const isProd = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      // easydraw.net and api.easydraw.net are same-site HTTPS origins.
      sameSite: 'lax' as const,
      secure: isProd,
      path: '/',
    };
  }

  /**
   * Opens a session and hands the browser its token.
   *
   * httpOnly keeps the token out of reach of any script on the page, so an
   * XSS bug cannot read it. The cookie expires with the session row, so the
   * browser stops sending a token the server would only reject.
   */
  private async startSession(req: Request, res: Response, userId: string) {
    const { token, expiresAt } = await this.sessions.create(userId, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    res.cookie(SESSION_COOKIE, token, {
      ...this.cookieOptions,
      expires: expiresAt,
    });

    await this.authService.noteLogin(userId);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('register')
  @RequireTrustedOrigin()
  async register(
    @Body() body: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(
      body.email,
      body.password,
      body.name,
    );
    await this.startSession(req, res, result.user.id);
    return result;
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @RequireTrustedOrigin()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body.email, body.password);
    await this.startSession(req, res, result.user.id);
    return result;
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('forgot-password')
  @RequireTrustedOrigin()
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    await this.authService.forgotPassword(body.email);
    return {
      message:
        'If an account exists for that email, a reset link has been sent.',
    };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @RequireTrustedOrigin()
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() body: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.resetPassword(body.token, body.password);
    // The reset revoked every session, including whatever this browser
    // held. Drop the dead cookie rather than let it fail on the next call.
    res.clearCookie(SESSION_COOKIE, this.cookieOptions);
    return { message: 'Password has been reset. You can now sign in.' };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('verify-email')
  @RequireTrustedOrigin()
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() body: VerifyEmailDto) {
    const { email } = await this.authService.verifyEmail(body.token);
    return { verified: true, email };
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(SessionAuthGuard)
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@CurrentUser() user: AuthUser) {
    await this.authService.resendVerification(user.sub);
    // Says nothing about whether one was needed: an already-verified
    // account is not information this endpoint needs to hand out.
    return {
      message: 'If your address still needs verifying, a link is on its way.',
    };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = sessionTokenFrom(req);
    // Revoke the row as well as clearing the cookie: a token that was
    // copied elsewhere must stop working, not just leave this browser.
    if (token) await this.sessions.revoke(token);
    res.clearCookie(SESSION_COOKIE, this.cookieOptions);
    return { loggedOut: true };
  }

  @UseGuards(SessionAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.sub);
  }

  /** The devices signed in to this account, so the owner can see and cut them off. */
  @UseGuards(SessionAuthGuard)
  @Get('sessions')
  sessionList(@CurrentUser() user: AuthUser) {
    return this.sessions.list(user.sub, user.sessionId);
  }

  @UseGuards(SessionAuthGuard)
  @Delete('sessions/:id')
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const revoked = await this.sessions.revokeById(user.sub, id);
    if (!revoked) throw new NotFoundException('No such session');
    if (id === user.sessionId)
      res.clearCookie(SESSION_COOKIE, this.cookieOptions);
    return { revoked: true };
  }

  /** Signs every other device out; this one stays. */
  @UseGuards(SessionAuthGuard)
  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  async revokeOtherSessions(@CurrentUser() user: AuthUser) {
    const count = await this.sessions.revokeAll(user.sub, user.sessionId);
    return { revoked: count };
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(SessionAuthGuard)
  @Delete('account')
  async deleteAccount(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.deleteAccount(user.sub);
    res.clearCookie(SESSION_COOKIE, this.cookieOptions);
    return { deleted: true };
  }

  // ROUTE 1 - kick off the flow. Guard redirects to Google; body never runs.
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {}

  // ROUTE 2 - Google redirects back with ?code=...
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    // validate() returned { user } -> Passport put it on req.user
    const { user } = req.user as unknown as { user: { id: string } };
    await this.startSession(req, res, user.id);
    return res.redirect(
      `${process.env.CLIENT_URL ?? 'http://localhost:5173'}/dashboard`,
    );
  }
}
