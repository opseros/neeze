import * as migration_20261112_053944_initial from './20261112_053944_initial';
import * as migration_20261112_055312_media_storage_prefix from './20261112_055312_media_storage_prefix';

export const migrations = [
  {
    up: migration_20261112_053944_initial.up,
    down: migration_20261112_053944_initial.down,
    name: '20261112_053944_initial',
  },
  {
    up: migration_20261112_055312_media_storage_prefix.up,
    down: migration_20261112_055312_media_storage_prefix.down,
    name: '20261112_055312_media_storage_prefix'
  },
];
