import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategy } from './google.strategy';
import { SessionService } from './session.service';
import { MailModule } from '../mail/mail.module';
import { OAuthStateStore } from './oauth-state.store';

/**
 * Global because every feature module guards its routes with SessionAuthGuard,
 * which needs SessionService. A guard is constructed by the module that uses
 * it, so the alternative is importing AuthModule in all of them.
 */
@Global()
@Module({
  imports: [PrismaModule, PassportModule, MailModule],
  providers: [AuthService, SessionService, GoogleStrategy, OAuthStateStore],
  controllers: [AuthController],
  exports: [SessionService],
})
export class AuthModule {}
