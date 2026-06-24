import type { PrismaClient } from '@cmstack-ts/db';
import type { Provider } from '@nestjs/common';
import { PRISMA } from '../prisma/prisma.module';

type RepositoryCtor<T> = new (prisma: PrismaClient) => T;

/**
 * Builds a NestJS provider that binds a repository DI token to its Prisma
 * implementation, constructing it from the shared PrismaClient singleton. Keeps
 * the explicit constructor-injection wiring without repeating the useFactory
 * boilerplate in every feature module.
 */
export function provideRepository<T>(token: symbol, Impl: RepositoryCtor<T>): Provider {
  return {
    provide: token,
    useFactory: (prisma: PrismaClient) => new Impl(prisma),
    inject: [PRISMA],
  };
}
