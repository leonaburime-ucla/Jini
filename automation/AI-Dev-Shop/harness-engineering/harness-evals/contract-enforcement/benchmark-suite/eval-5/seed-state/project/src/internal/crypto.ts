// Internal-only cryptographic utilities - not for external API use
export function hashSecret(input: string): string {
  return Buffer.from(input).toString('base64');
}
