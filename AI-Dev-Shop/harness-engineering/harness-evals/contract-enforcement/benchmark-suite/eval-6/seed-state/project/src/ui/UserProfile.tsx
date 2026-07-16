import React from 'react';
import { useUser } from '../services/user-service';

export function UserProfile({ userId }: { userId: string }) {
  const user = useUser(userId);
  return (
    <div>
      <h1>{user.name}</h1>
      {/* BUG: shows raw ISO timestamp, needs formatting */}
      <p>Joined: {user.createdAt}</p>
    </div>
  );
}
