import { request } from './client';

export interface User {
	  id: string;
    username: string;
    email: string;
    friend_code: string;
    created_at: string;
    updated_at: string;
}

interface AuthResponse {
    user: User;
}

export async function register(username: string, email: string, password: string): Promise<User> {
    const response = await request<AuthResponse>(
        '/api/auth/register',
        {
            method: 'POST',
            body: JSON.stringify({
                username,
                email,
                password,
            }),
        },
    );

    return response.user;
}

export async function login(email: string, password: string): Promise<User> {
  const response = await request<AuthResponse>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
      }),
    },
  );

  return response.user;
}

export async function logout(): Promise<void> {
    await request<{ success: boolean }>(
        '/api/auth/logout',
        {
            method: 'POST',
        },
    );
}

export async function getCurrentUser(): Promise<User | null> {
    try {
      const response = await request<AuthResponse>(
        '/api/auth/me',
      );

      return response.user;
    } 
    catch (error) {
        if (
            error instanceof Error &&
            error.message === 'Authentication required'
        ) {
            return null;
        }

          throw error;
    }
}

export async function updateUsername(username: string): Promise<User> {
    const response = await request<AuthResponse>(
        '/api/auth/username',
        {
            method: 'PATCH',
            body: JSON.stringify({ username }),
        },
    );

    return response.user;
}

export async function updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    await request<{ success: boolean }>(
        '/api/auth/password',
        {
            method: 'PATCH',
            body: JSON.stringify({
                currentPassword,
                newPassword,
            }),
        },
    );
}