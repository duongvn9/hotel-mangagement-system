import { Inject, Logger, Module, type OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  NOTIFICATION_OPTIONS,
  type NotificationOptions,
} from '../../config/notifications.config.js';
import { NotificationScheduler } from './notification.scheduler.js';
import {
  DisabledNotificationTransport,
  GmailNotificationTransport,
} from './notification.transport.js';
import { NOTIFICATION_TRANSPORT } from './notification.types.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [ConfigModule],
  providers: [
    NotificationScheduler,
    NotificationsService,
    {
      provide: NOTIFICATION_OPTIONS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.getOrThrow<NotificationOptions>('notifications'),
    },
    {
      provide: NOTIFICATION_TRANSPORT,
      inject: [NOTIFICATION_OPTIONS],
      useFactory: (options: NotificationOptions) =>
        options.enabled
          ? new GmailNotificationTransport(options)
          : new DisabledNotificationTransport(),
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule implements OnModuleInit {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}
  onModuleInit(): void {
    if (
      this.config.get('env') === 'production' &&
      !this.config.get('notifications.enabled')
    )
      new Logger(NotificationsModule.name).warn({
        event: 'notifications_disabled_in_production',
      });
  }
}
