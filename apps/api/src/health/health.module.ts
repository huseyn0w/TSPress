import { Module } from '@nestjs/common';
import { prisma } from '@cmstack-ts/db';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { DATABASE_PINGER } from './health.tokens';

@Module({
  controllers: [HealthController],
  providers: [HealthService, { provide: DATABASE_PINGER, useValue: prisma }],
})
export class HealthModule {}
