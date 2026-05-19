export interface SendOptions {
  to: string[];
  subject: string;
  body: string;
}

export interface EmailService {
  send(options: SendOptions): Promise<void>;
}
