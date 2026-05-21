import nodemailer from 'nodemailer';
import { EmailService, SendOptions } from './EmailService';
import { config } from '../../config';

class NodemailerService implements EmailService {
  private transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: false,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });

  async send({ to, subject, body }: SendOptions): Promise<void> {
    await this.transporter.sendMail({
      from: config.smtp.from,
      to: to.join(', '),
      subject,
      text: body,
    });
  }
}

// Parses "Display Name <email@example.com>" → { name, email }
function parseFrom(from: string): { name: string; email: string } {
  const match = from.match(/^(.*?)\s*<(.+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: '', email: from.trim() };
}

class BrevoEmailService implements EmailService {
  async send({ to, subject, body }: SendOptions): Promise<void> {
    const sender = parseFrom(config.smtp.from);
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY!,
      },
      body: JSON.stringify({
        sender,
        to: to.map(email => ({ email })),
        subject,
        textContent: body,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Brevo ${res.status}: ${text}`);
    }
  }
}

export const emailService: EmailService = process.env.BREVO_API_KEY
  ? new BrevoEmailService()
  : new NodemailerService();
