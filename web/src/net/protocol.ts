export type ServerToWebMessage =
  | { type: 'phone_status'; connected: boolean }
  | { type: 'motion'; yawRate: number; pitchRate: number; t: number };

export interface WebHelloMessage {
  type: 'hello';
  role: 'web';
}
