import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  getAuthSessionByTokenHash,
  updateAuthSessionLastUsed,
} from '../repositories/auth-sessions.repository.ts';

import { hashSessionToken, } from './session.ts';

import { getPublicUserById, } from '../services/auth.service.ts';

const SESSION_COOKIE_NAME = 'sb_session';

declare module 'fastify' {
    interface FastifyRequest {
        user: {
            id: string;
            username: string;
            email: string;
            friend_code: string;
            created_at: string;
            updated_at: string;
        };
        authSessionId: number | null;
    }
}

function getSessionToken(request: FastifyRequest,): string | null {
    return request.cookies?.[SESSION_COOKIE_NAME] ?? null;
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply,): Promise<void> {
    const sessionToken = getSessionToken(request);

    if(!sessionToken) {
        reply.code(401).send({
            error: 'Authentication required',
        });

        return;
    }

    const tokenHash = hashSessionToken(sessionToken);
    const session = getAuthSessionByTokenHash(tokenHash);
    if(!session) {
        reply.code(401).send({
            error: 'Authentication required',
        });

        return;
    }

    const expiresAt = new Date(session.expires_at);
    if(expiresAt <= new Date()) {
        reply.code(401).send({
            error: 'Authentication required',
        });

        return;
    }

    const user = getPublicUserById(session.user_id);
    if(!user) {
        reply.code(401).send({
            error: 'Authentication required',
        });
        
        return;
    }

    updateAuthSessionLastUsed(session.id);

    request.user = user;
    request.authSessionId = session.id;
}