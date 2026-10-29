import type { FastifyInstance } from 'fastify';

import { login, register, logout, changeUsername, changePassword} from '../services/auth.service.js';

import { authenticate } from '../auth/middleware.js';
import { authRateLimitConfig } from '../config/rate-limit.js';

const SESSION_COOKIE_NAME = 'sb_session';

const isProduction = process.env.NODE_ENV === 'production';

const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
};

export async function authRoutes(server: FastifyInstance): Promise<void> {
    server.post<{
        Body: {
            username: string;
            email: string;
            password: string;
        };
    }>('/api/auth/register', {
        config: {
            rateLimit: authRateLimitConfig.register,
        },
        schema: {
            body: {
                type: 'object',
                required: ['username', 'email', 'password'],
                additionalProperties: false,
                properties: {
                    username: {
                        type: 'string',
                        minLength: 3,
                        maxLength: 50,
                    },
                    email: {
                        type: 'string',
                        minLength: 3,
                        maxLength: 254,
                    },
                    password: {
                        type: 'string',
                        minLength: 12,
                        maxLength: 128,
                    },
                },
            },
        },
    }, async (request, reply) => {
        try {
            const result = await register({
                username: request.body.username.trim(),
                email: request.body.email.trim().toLowerCase(),
                password: request.body.password,
            });

            reply.setCookie(
                  SESSION_COOKIE_NAME,
                  result.sessionToken,
                  {
                    ...cookieOptions,
                    expires: new Date(result.expiresAt),
                  },
            )
            .code(201);

            return {user: result.user,};
        } 
        catch (error) {
            if(error instanceof Error && error.message === 'Unable to create account') {
                return reply.code(409).send({
                    error: 'Unable to create account',
                });
            }

            request.log.error(error);

            return reply.code(500).send({
                error: 'Internal server error',
            });
        }
    });

    server.post<{
        Body: {
            email: string;
            password: string;
        };
    }>('/api/auth/login', {
        config: {
            rateLimit: authRateLimitConfig.login,
        },
        schema: {
            body: {
                type: 'object',
                required: ['email', 'password'],
                additionalProperties: false,
                properties: {
                    email: {
                        type: 'string',
                        minLength: 3,
                        maxLength: 254,
                    },
                    password: {
                        type: 'string',
                        minLength: 1,
                        maxLength: 128,
                    },
                },
            },
        },
    }, async (request, reply) => {
        try {
            const result = await login({
                email: request.body.email.trim().toLowerCase(),
                password: request.body.password,
            });

            reply.setCookie(
                SESSION_COOKIE_NAME,
                result.sessionToken,
                {
                  ...cookieOptions,
                  expires: new Date(result.expiresAt),
                },
            );

            return {user: result.user,};
        } 
        catch (error) {
            if(error instanceof Error && error.message === 'Invalid email or password') {
                return reply.code(401).send({
                    error: 'Invalid email or password',
                });
            }

            request.log.error(error);

            return reply.code(500).send({
                error: 'Internal server error',
            });
        }
    });

    server.post('/api/auth/logout', {
        preHandler: authenticate,
    }, async (request, reply) => {
        const sessionToken = request.cookies[SESSION_COOKIE_NAME];

        if(
            sessionToken) {
            logout(sessionToken);
        }

        reply.clearCookie(
            SESSION_COOKIE_NAME,
            {
              path: '/',
            },
        );

        return {
            success: true,
        };
    });

    server.get('/api/auth/me', {
        preHandler: authenticate,
    }, async (request) => {
        return {
            user: request.user,
        };
    });


    server.patch<{
        Body: {
            username: string;
        };
    }>('/api/auth/username', {
        preHandler: authenticate,
        schema: {
            body: {
                type: 'object',
                required: ['username'],
                additionalProperties: false,
                properties: {
                    username: {
                        type: 'string',
                        minLength: 3,
                        maxLength: 50,
                    },
                },
            },
        },
    }, async (request, reply) => {
        try {
            const user = changeUsername(
                request.user.id,
                request.body.username.trim(),
            );

            return { user };
        } 
        catch (error) {
            if (error instanceof Error && error.message === 'User not found') {
                return reply.code(404).send({
                    error: 'User not found',
                });
            }

            if (error instanceof Error && error.message.includes('UNIQUE constraint failed: users.username')) {
                return reply.code(409).send({
                    error: 'Username is already taken',
                });
            }

            request.log.error(error);

            return reply.code(500).send({
                error: 'Internal server error',
            });
        }
    });

    server.patch<{
        Body: {
            currentPassword: string;
            newPassword: string;
        };
    }>('/api/auth/password', {
        preHandler: authenticate,
        schema: {
            body: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                additionalProperties: false,
                properties: {
                    currentPassword: {
                        type: 'string',
                        minLength: 1,
                    },
                    newPassword: {
                        type: 'string',
                        minLength: 12,
                        maxLength: 128,
                    },
                },
            },
        },
    }, async (request, reply) => {
        try {
            if(request.authSessionId === null) {
                return reply.code(401).send({
                    error: 'Authentication required',
                })
            }
            await changePassword(
                request.user.id,
                request.authSessionId,
                request.body.currentPassword,
                request.body.newPassword,
            );

            return { success: true };
        } catch (error) {
            if (error instanceof Error) {
                if (error.message === 'Current password is incorrect') {
                    return reply.code(400).send({
                        error: error.message,
                    });
                }

                if (error.message === 'User not found') {
                    return reply.code(404).send({
                        error: error.message,
                    });
                }
            }

            request.log.error(error);

            return reply.code(500).send({
                error: 'Internal server error',
            });
        }
    });
}