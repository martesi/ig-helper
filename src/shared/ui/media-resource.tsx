import { render } from 'preact';

export interface MediaResourceData {
    mediaId?: string | number;
    datetime: number;
    blob?: boolean;
    name: string;
    type: string;
    username?: string | null;
    path?: string | null;
    index: number;
    href: string;
    preview?: string;
    labelKey?: string;
    label?: string;
    displayIndex?: number;
}

export function appendMediaResource(parent: Node, resource: MediaResourceData): ChildNode {
    const fragment = document.createDocumentFragment();
    render(<MediaResource resource={resource} />, fragment);
    const element = fragment.firstChild;
    if (!element) throw new Error('Could not create media resource');
    parent.appendChild(element);
    return element;
}

export function appendLoadingMessage(parent: Node, message: string): ChildNode {
    const fragment = document.createDocumentFragment();
    render(<p id="_SNLOAD">{message}</p>, fragment);
    const element = fragment.firstChild;
    if (!element) throw new Error('Could not create loading message');
    parent.appendChild(element);
    return element;
}

function MediaResource({ resource }: { resource: MediaResourceData }) {
    const attributes = {
        'media-id': resource.mediaId,
        datetime: resource.datetime,
        'data-blob': resource.blob ? 'true' : undefined,
        'data-needed': 'direct',
        'data-name': resource.name,
        'data-type': resource.type,
        'data-username': resource.username ?? '',
        'data-path': resource.path ?? '',
        'data-globalindex': resource.index,
        'data-preview': resource.preview,
        href: 'javascript:;',
        'data-href': resource.href,
    };

    return <a {...attributes} />;
}
