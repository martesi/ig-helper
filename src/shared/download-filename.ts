export interface SaveMetadata {
    username?: string;
    sourceType?: string;
    timestamp: number;
    filetype: string;
    shortcode?: string | null;
    index?: number | null;
    uid?: string | number | null;
}

export interface SaveFilenameOptions {
    renameFormat: string;
    autoRename: boolean;
}

export function getSaveFileName(downloadLink: string, metadata: SaveMetadata, options: SaveFilenameOptions): string {
    const { username, sourceType, timestamp, filetype, shortcode, uid } = metadata;
    const mediaKind = ['mp4', 'm4a'].includes(filetype.toLowerCase()) ? 'video' : 'photo';
    const normalizedTimestamp = parseInt(timestamp.toString().padEnd(13, '0'));
    const index = metadata.index ?? 0;

    const date = new Date(normalizedTimestamp);
    const original_name = (new URL(downloadLink).pathname.split('/').at(-1) ?? '').split('.').slice(0, -1).join('.');
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    const second = date.getSeconds().toString().padStart(2, '0');

    let filename = options.renameFormat.replace(/%([^%]+)%/g, (match, content) => {
        return `%${content.toUpperCase()}%`;
    });

    const replacements: Record<string, string> = {
        '%USERNAME%': username ?? '',
        '%SOURCE_TYPE%': mediaKind,
        '%SOURCE%': sourceType ?? '',
        '%SHORTCODE%': shortcode || '',
        '%YEAR%': year,
        '%2-YEAR%': year.substr(-2),
        '%MONTH%': month,
        '%DAY%': day,
        '%HOUR%': hour,
        '%MINUTE%': minute,
        '%SECOND%': second,
        '%ORIGINAL_NAME%': original_name,
        '%ORIGINAL_NAME_FIRST%': original_name.split('_').at(0) ?? '',
        '%INDEX%': index.toString(),
        '%UID%': String(uid || ''),
    };

    filename = filename.replace(/%[\w\-]+%/g, str => {
        if (replacements[str] == null) return str;
        return replacements[str];
    });

    const originally = (username ?? '') + '_' + original_name + '.' + filetype;
    return options.autoRename ? filename + '.' + filetype : originally;
}
