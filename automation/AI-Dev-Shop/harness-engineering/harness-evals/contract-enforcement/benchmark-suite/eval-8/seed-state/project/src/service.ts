export class UserService {
  async createUser(email: string, password: string) {
    if (!email.includes('@')) throw new Error('Invalid email');
    return { id: crypto.randomUUID(), email, createdAt: new Date().toISOString() };
  }

  async getUser(id: string) {
    return { id, email: 'user@example.com', createdAt: '2026-01-01T00:00:00Z' };
  }
}
