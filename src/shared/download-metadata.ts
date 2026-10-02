import type { SaveMetadata } from './download';
import type { UserSettings } from '../settings/schema';

export function needsDownloadUserId(metadata: SaveMetadata, settings: UserSettings, renameFormat: string): boolean {
    return (settings.AUTO_RENAME && /%UID%/i.test(renameFormat)) || Boolean(
        settings.MODIFY_RESOURCE_EXIF && metadata.filetype === 'jpg' &&
        metadata.shortcode && metadata.sourceType === 'photo',
    );
}
