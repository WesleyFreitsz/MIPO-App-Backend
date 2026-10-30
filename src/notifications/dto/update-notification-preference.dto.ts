import { IsBoolean, IsIn } from 'class-validator';
import { NOTIFICATION_CATEGORIES } from '../notification-category';

export class UpdateNotificationPreferenceDto {
  @IsIn(NOTIFICATION_CATEGORIES)
  type: string;

  @IsBoolean()
  enabled: boolean;
}
