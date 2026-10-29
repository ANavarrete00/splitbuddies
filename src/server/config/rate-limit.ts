
const DEFAULT_LOGIN_MAX = 10;
const DEFAULT_LOGIN_WINDOW = '1 minute';
const DEFAULT_REGISTER_MAX = 5;
const DEFAULT_REGISTER_WINDOW = '1 hour';

function readPositiveInteger(name: string, defaultValue: number): number {
    const rawValue = process.env[name];

    if(rawValue === undefined || rawValue.trim() === '') {
        return defaultValue;
    }

    const value = Number(rawValue);

    if(!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(
            `Invalid ${name}: expected a positive integer, received "${rawValue}".`,
        );
    }

    return value;
}

function readPositiveDuration(name: string, defaultValue: string): string {
    const rawValue = process.env[name];

    if(rawValue === undefined || rawValue.trim() === '') {
        return defaultValue;
    }

    // Fastify rate-limit accepts a duration in milliseconds or a human-readable
    // duration string. Validate the supported human-readable format here.
    const match = rawValue.trim().match(
        /^(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|seconds?|m|minutes?|h|hours?|d|days?)$/i,
    );

    if(!match || Number(match[1]) <= 0) {
        throw new Error(
            `Invalid ${name}: expected a positive duration such as "1 minute" or "30 seconds", received "${rawValue}".`,
        );
    }

    return rawValue.trim();
}

export const authRateLimitConfig = {
    login: {
        max: readPositiveInteger('AUTH_LOGIN_RATE_LIMIT_MAX', DEFAULT_LOGIN_MAX),
        timeWindow: readPositiveDuration(
            'AUTH_LOGIN_RATE_LIMIT_WINDOW',
            DEFAULT_LOGIN_WINDOW,
        ),
    },
    register: {
        max: readPositiveInteger('AUTH_REGISTER_RATE_LIMIT_MAX', DEFAULT_REGISTER_MAX),
        timeWindow: readPositiveDuration(
            'AUTH_REGISTER_RATE_LIMIT_WINDOW',
            DEFAULT_REGISTER_WINDOW,
        ),
    },
};
