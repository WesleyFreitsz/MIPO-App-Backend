import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SessionThrottlerGuard } from './session-throttler.guard';

@Module({
  providers: [{ provide: APP_GUARD, useClass: SessionThrottlerGuard }],
})
export class CommonSecurityModule {}
