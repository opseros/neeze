import * as migration_20261112_053944_initial from './20261112_053944_initial';
import * as migration_20261112_055312_media_storage_prefix from './20261112_055312_media_storage_prefix';
import * as migration_20261112_081627_social_and_email_signin from './20261112_081627_social_and_email_signin';
import * as migration_20261112_092109_notifications from './20261112_092109_notifications';
import * as migration_20261112_100346_reviews_and_p1_types from './20261112_100346_reviews_and_p1_types';
import * as migration_20261112_115739_manipuri_locales from './20261112_115739_manipuri_locales';
import * as migration_20261112_115900_manipuri_names from './20261112_115900_manipuri_names';
import * as migration_20261112_123730_community from './20261112_123730_community';

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
    name: '20261112_092109_notifications',
  },
  {
    up: migration_20261112_100346_reviews_and_p1_types.up,
    down: migration_20261112_100346_reviews_and_p1_types.down,
    name: '20261112_100346_reviews_and_p1_types',
  },
  {
    up: migration_20261112_115739_manipuri_locales.up,
    down: migration_20261112_115739_manipuri_locales.down,
    name: '20261112_115739_manipuri_locales',
  },
  {
    up: migration_20261112_115900_manipuri_names.up,
    down: migration_20261112_115900_manipuri_names.down,
    name: '20261112_115900_manipuri_names',
  },
  {
    up: migration_20261112_123730_community.up,
    down: migration_20261112_123730_community.down,
    name: '20261112_123730_community'
  },
];
