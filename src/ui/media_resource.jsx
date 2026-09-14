import { Fragment, h, render } from 'preact';
import { Button } from './components.jsx';

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

export function renderPostIdLink(parent, postPath) {
    render(<a href={`https://www.instagram.com/p/${postPath}`}>{postPath}</a>, parent);
}

export function decorateMediaResource(anchor, { icons, labels, includeNewTab = true, includeThumbnail = false } = {}) {
    const wrapper = document.createElement('div');
    anchor.replaceWith(wrapper);
    wrapper.append(anchor);

    const before = document.createDocumentFragment();
    render(
        <label class="inner_box_wrapper">
            <input class="inner_box" type="checkbox" />
            <span />
        </label>,
        before,
    );
    wrapper.prepend(before.firstChild);

    const after = document.createDocumentFragment();
    render(
        <>
            {includeNewTab && (
                <Button class="newTab" variant="ghost" size="icon-sm"
                    data-ih-locale-title="NEW_TAB" title={labels.newTab} aria-label={labels.newTab}
                    dangerouslySetInnerHTML={{ __html: icons.newTab }} />
            )}
            {includeThumbnail && (
                <Button class="videoThumbnail" variant="ghost" size="icon-sm"
                    data-ih-locale-title="VIDEO_THUMBNAIL" title={labels.thumbnail} aria-label={labels.thumbnail}
                    dangerouslySetInnerHTML={{ __html: icons.thumbnail }} />
            )}
        </>,
        after,
    );
    while (after.firstChild) wrapper.append(after.firstChild);
    return wrapper;
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
        href: 'javascript:;',
        'data-href': resource.href,
    };

    return (
        <a {...attributes}>
            <img width="100" src={resource.preview} alt="" />
            <br />
            - <span data-ih-locale={resource.labelKey}>{resource.label}</span> {resource.displayIndex ?? resource.index} -
        </a>
    );
}
