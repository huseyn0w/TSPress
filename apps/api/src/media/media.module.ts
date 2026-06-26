import { parseEnv } from '@cmstack-ts/config';
import { MEDIA_REPOSITORY, PrismaMediaRepository } from '@cmstack-ts/db';
import { Module } from '@nestjs/common';
import { AccountsModule } from '../auth/accounts.module';
import { provideRepository } from '../persistence/repository.providers';
import { IMAGE_PROCESSOR } from './image-processor';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { SharpImageProcessor } from './sharp-image-processor';
import { StorageModule } from './storage.module';

@Module({
  // AccountsModule provides the auth guards; StorageModule provides STORAGE.
  imports: [AccountsModule, StorageModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    provideRepository(MEDIA_REPOSITORY, PrismaMediaRepository),
    {
      provide: IMAGE_PROCESSOR,
      useFactory: () => new SharpImageProcessor(parseEnv().MEDIA_MAX_MEGAPIXELS),
    },
  ],
})
export class MediaModule {}
