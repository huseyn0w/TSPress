import {
  FAQ_REPOSITORY,
  type PrismaClient,
  PrismaFaqRepository,
  PrismaServiceRepository,
  PrismaSiteProfileRepository,
  SERVICE_REPOSITORY,
  SITE_PROFILE_REPOSITORY,
} from '@cmstack-ts/db';
import { Module } from '@nestjs/common';
import { AccountsModule } from '../auth/accounts.module';
import { PRISMA } from '../prisma/prisma.module';
import { PublicSeoController } from './public-seo.controller';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';

@Module({
  // AccountsModule provides the JwtAuthGuard/PoliciesGuard used to gate the admin
  // SEO controller.
  imports: [AccountsModule],
  controllers: [SeoController, PublicSeoController],
  providers: [
    SeoService,
    {
      provide: SITE_PROFILE_REPOSITORY,
      useFactory: (prisma: PrismaClient) => new PrismaSiteProfileRepository(prisma),
      inject: [PRISMA],
    },
    {
      provide: SERVICE_REPOSITORY,
      useFactory: (prisma: PrismaClient) => new PrismaServiceRepository(prisma),
      inject: [PRISMA],
    },
    {
      provide: FAQ_REPOSITORY,
      useFactory: (prisma: PrismaClient) => new PrismaFaqRepository(prisma),
      inject: [PRISMA],
    },
  ],
})
export class SeoModule {}
