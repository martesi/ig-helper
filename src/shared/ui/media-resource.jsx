import { render } from 'preact';
export function appendMediaResource(parent, resource) {
    const fragment = document.createDocumentFragment();
    render(<MediaResource resource={resource} />, fragment);
    const element = fragment.firstChild;
    parent.append(element);
    return element;
}

export function appendLoadingMessage(parent, message) {
    const fragment = document.createDocumentFragment();
    render(<p id="_SNLOAD">{message}</p>, fragment);
    const element = fragment.firstChild;
    parent.append(element);
    return element;
}

function MediaResource({ resource }) {
    const attributes = {
        'media-id': resource.mediaId,
        datetime: resource.datetime,
        'data-blob': resource.blob ? 'true' : undefined,
        'data-needed': 'direct',
        'data-name': resource.name,
        'data-type': resource.type,
        'data-username': resource.username ?? '',
        'data-path': resource.path,
        'data-globalindex': resource.index,
        'data-preview': resource.preview,
        href: 'javascript:;',
        'data-href': resource.href,
    };

    return <a {...attributes} />;
}
