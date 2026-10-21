import Fastify from 'fastify';
import cookie from '@fastify/cookie';

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';

import { db } from './db/database.ts';
import { authRoutes } from './routes/auth.routes.js';

import { GroupsRepository } from './repositories/groups.repository.js';
import { GroupService } from './services/group.service.js';
import { GroupBalanceService } from './services/group-balance.service.ts';
import { groupsRoutes } from './routes/groups.routes.js';

import { FriendsRepository } from './repositories/friends.repository.js';
import { FriendService } from './services/friend.service.ts';
import { friendsRoutes } from './routes/friends.routes.js';

import { ExpensesRepository } from './repositories/expenses.repository.ts';
import { ExpenseService } from './services/expense.service.ts';
import { expensesRoutes } from './routes/expenses.routes.ts';

import { SettlementsRepository } from './repositories/settlements.repository.ts';
import { SettlementsService } from './services/settlements.service.ts';

import { NotificationsRepository } from './repositories/notifications.repository.ts';
import { NotificationsService } from './services/notification.service.ts';
import { NotificationsRoutes } from './routes/notifications.routes.ts';

const server = Fastify({logger: true,});

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, '../dist');

const notificationsRepository = new NotificationsRepository(db);
const notificationsService = new NotificationsService(notificationsRepository);

const friendsRepository = new FriendsRepository(db);
const friendService = new FriendService(friendsRepository, notificationsService);

const groupsRepository = new GroupsRepository(db);
const expensesRepository = new ExpensesRepository(db);
const groupBalanceService = new GroupBalanceService();
const settlementsRepository = new SettlementsRepository(db);
const settlementsService = new SettlementsService(settlementsRepository, groupsRepository, notificationsService);

const groupService = new GroupService(
    groupsRepository,
    friendsRepository,
    expensesRepository,
    groupBalanceService,
    settlementsRepository,
    notificationsService,
)

const expenseService = new ExpenseService(expensesRepository, groupsRepository, notificationsService);

const start = async () => {
    try {
        await server.register(cookie);

        await server.register(authRoutes);

        await server.register(
            (instance) => groupsRoutes(
              instance,
              groupService,
              settlementsService,
            ),
        );

        await server.register(
            (instance) => friendsRoutes(
              instance,
              friendService,
            ),
        );

        await server.register(
            (instance) => NotificationsRoutes(
                instance,
                notificationsService,
            )
        )

        await expensesRoutes(
            server,
            expenseService,
        );

        server.get('/api/health', async () => {
            const result = db.prepare('SELECT 1 AS database_ok')
                .get() as { database_ok: number };

            return {
                status: 'ok',
                service: 'splitbuddies-api',
                database: result.database_ok === 1 ? 'ok' : 'error',
            };
        });

        if(process.env.NODE_ENV === 'production') {
            await server.register(fastifyStatic, {
                root: frontendDistPath,
                wildcard: false,
            });

            server.setNotFoundHandler((request, reply) => {
                if(request.method === 'GET' && !request.url.startsWith('/api/')) {
                    return reply.sendFile('index.html');
                }

                return reply.code(404).send({
                    error: 'Not Found',
                });
            });
        }

        await server.listen({
            port: PORT,
            host: HOST,
        });
    } 
    catch (error) {
        server.log.error(error);
        process.exit(1);
    }
};

start();
