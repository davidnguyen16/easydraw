import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    private readonly transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT ?? 2525),
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS,
        },
    });

    async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
        await this.transporter.sendMail({
            from: process.env.MAIL_FROM ?? 'EasyDraw <noreply@easydraw.net>',
            to,
            subject: 'Reset your EasyDraw password',
            text: `Reset your password (link expires in 30 minutes): ${resetUrl}`,
            html: `
                <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:8px">
                    <h2 style="color:#2c2c2a">Reset your password</h2>
                    <p style="color:#5f5e5a;line-height:1.5">
                         We received a request to reset your EasyDraw password.
                         Click the button below — this link expires in <strong>30 minutes</strong>.
                    </p>
                    <a href="${resetUrl}"
                       style="display:inline-block;background:#a6192e;color:#fff;padding:12px 24px;
                              border-radius:8px;text-decoration:none;font-weight:600;margin:8px 0">
                       Reset password
                    </a>
                    <p style="color:#8a8b83;font-size:13px;margin-top:24px">
                        If you didn't request this, you can safely ignore this email.
                    </p>
                </div>`,
            });
            this.logger.log(`Password reset email sent to ${to}`);
        }
    }