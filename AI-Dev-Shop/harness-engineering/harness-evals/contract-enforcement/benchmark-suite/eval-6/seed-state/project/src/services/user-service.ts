import { useState, useEffect } from 'react';

interface User { id: string; name: string; createdAt: string; }

export function useUser(userId: string): User {
  const [user, setUser] = useState<User>({ id: '', name: '', createdAt: '' });
  useEffect(() => { /* fetch user */ }, [userId]);
  return user;
}
// Note: does NOT expose formatDate - that's in data/formatters
