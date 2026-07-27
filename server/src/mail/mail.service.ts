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
      replyTo: 'support@easydraw.net',
      to,
      subject: 'Reset your EasyDraw password',
      text: `Reset your password

We received a request to reset the password for your EasyDraw account. This link will expire in 30 minutes.

Reset it here: ${resetUrl}

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged. For your security, this link can only be used once.

Need help? Contact us at support@easydraw.net

The EasyDraw Team`,
      html: `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                       style="background:#f5f3ef;margin:0;padding:0">
                    <tr>
                        <td align="center" style="padding:32px 16px">
                            <table role="presentation" width="600" cellpadding="0" cellspacing="0"
                                   style="width:600px;max-width:100%;background:#ffffff;border:1px solid #e3e0d6;border-radius:12px">
                                <tr>
                                    <td style="padding:36px 40px;font-family:system-ui,-apple-system,sans-serif">
                                        <div style="font-size:22px;font-weight:700;letter-spacing:-0.02em;margin:0 0 28px">
                                            <span style="color:#a6192e">Easy</span><span style="color:#2c2c2a">Draw</span>
                                        </div>
                                        <h1 style="color:#2c2c2a;font-size:24px;margin:0 0 16px">Reset your password</h1>
                                        <p style="color:#5f5e5a;font-size:16px;line-height:1.6;margin:0 0 28px">
                                            We received a request to reset the password for your EasyDraw account.
                                            This link will expire in <strong>30 minutes</strong>.
                                        </p>
                                        <a href="${resetUrl}"
                                           style="display:inline-block;background:#a6192e;color:#ffffff;padding:14px 32px;
                                                  border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">
                                            Reset my password
                                        </a>
                                        <p style="color:#8a8b83;font-size:14px;line-height:1.6;margin:28px 0 6px">
                                            If the button doesn't work, copy and paste the link below into your browser:
                                        </p>
                                        <p style="margin:0 0 28px;font-size:14px;line-height:1.5;word-break:break-all">
                                            <a href="${resetUrl}" style="color:#a6192e">${resetUrl}</a>
                                        </p>
                                        <p style="color:#8a8b83;font-size:14px;line-height:1.6;margin:0 0 8px">
                                            If you didn't request a password reset, you can safely ignore this email.
                                            Your password will remain unchanged.
                                        </p>
                                        <p style="color:#8a8b83;font-size:14px;line-height:1.6;margin:0 0 28px">
                                            For your security, this link can only be used once.
                                        </p>
                                        <p style="color:#5f5e5a;font-size:15px;line-height:1.6;margin:0">The EasyDraw Team</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:18px 40px;background:#faf9f6;border-top:1px solid #e3e0d6;
                                               font-family:system-ui,-apple-system,sans-serif">
                                        <p style="color:#b4b2a9;font-size:12px;line-height:1.6;margin:0">
                                            Need help? Email us at
                                            <a href="mailto:support@easydraw.net" style="color:#8a8b83;text-decoration:underline">support@easydraw.net</a><br />
                                            © 2026 EasyDraw
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>`,
    });
    this.logger.log('Password reset email accepted by the SMTP provider');
  }
}
