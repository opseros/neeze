import * as migration_20261112_053944_initial from './20261112_053944_initial';
import * as migration_20261112_055312_media_storage_prefix from './20261112_055312_media_storage_prefix';
import * as migration_20261112_081627_social_and_email_signin from './20261112_081627_social_and_email_signin';
import * as migration_20261112_092109_notifications from './20261112_092109_notifications';

export const migrations = [
  {
    up: migration_20261112_053944_initial.up,
    down: migration_20261112_053944_initial.down,
    name: '20261112_053944_initial',
  },
  {
    up: migration_20261112_055312_media_storage_prefix.up,
    down: migration_20261112_055312_media_storage_prefix.down,
    name: '20261112_055312_media_storage_prefix',
  },
  {
    up: migration_20261112_081627_social_and_email_signin.up,
    down: migration_20261112_081627_social_and_email_signin.down,
    name: '20261112_081627_social_and_email_signin',
  },
  {
    up: migration_20261112_092109_notifications.up,
    down: migration_20261112_092109_notifications.down,
    name: '20261112_092109_notifications'
  },
];
