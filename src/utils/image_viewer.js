import htm from 'htm';
import { h, render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { SVG } from '../settings';

const VIEWER_ROOT_ID = 'ig-helper-image-viewer-root';
const html = htm.bind(h);

export function openImageViewer(imageUrl) {
    removeImageViewer();
    const root = document.createElement('div');
    root.id = VIEWER_ROOT_ID;
    document.body.append(root);
    render(html`<${ImageViewer} imageUrl=${imageUrl} />`, root);
}

export function removeImageViewer() {
    const root = document.getElementById(VIEWER_ROOT_ID);
    if (!root) return;
    render(null, root);
    root.remove();
}

function ImageViewer({ imageUrl }) {
    const sectionRef = useRef(null);
    const dragRef = useRef(null);
    const didDragRef = useRef(false);
    const [transform, setTransform] = useState({ rotate: 0, scale: 1, x: 0, y: 0 });

    useEffect(() => {
        function moveImage(event) {
            const drag = dragRef.current;
            if (!drag) return;
            event.preventDefault();
            drag.moved = true;
            setTransform(current => ({
                ...current,
                x: event.pageX - drag.startX,
                y: event.pageY - drag.startY,
            }));
        }

        function stopDragging() {
            didDragRef.current = Boolean(dragRef.current?.moved);
            dragRef.current = null;
        }

        document.addEventListener('mousemove', moveImage);
        document.addEventListener('mouseup', stopDragging);
        return () => {
            document.removeEventListener('mousemove', moveImage);
            document.removeEventListener('mouseup', stopDragging);
        };
    }, []);

    function zoomAt(event, requestedScale) {
        event.preventDefault();
        const rect = sectionRef.current.getBoundingClientRect();
        setTransform(current => {
            const scale = requestedScale ?? Math.min(5, Math.max(1,
                current.scale + (event.deltaY < 0 ? 0.1 : -0.1) * current.scale));
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const targetX = (mouseX - current.x) / current.scale;
            const targetY = (mouseY - current.y) / current.scale;
            return {
                ...current,
                scale,
                x: -targetX * scale + mouseX,
                y: -targetY * scale + mouseY,
            };
        });
    }

    function toggleZoom(event) {
        event.preventDefault();
        event.stopPropagation();
        if (didDragRef.current) {
            didDragRef.current = false;
            return;
        }
        if (transform.scale > 1) {
            setTransform(current => ({ ...current, scale: 1, x: 0, y: 0 }));
            return;
        }
        zoomAt(event, 2.25);
    }

    function startDragging(event) {
        if (transform.scale === 1) return;
        dragRef.current = {
            moved: false,
            startX: event.pageX - transform.x,
            startY: event.pageY - transform.y,
        };
    }

    const translateStyle = {
        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        transformOrigin: '0 0',
        transition: dragRef.current?.moved ? 'none' : 'transform 0.15s ease',
        willChange: 'transform',
    };
    const rotateStyle = {
        transform: `rotate(${transform.rotate}deg)`,
        transformOrigin: 'center',
        transition: 'transform 0.15s ease',
        willChange: 'transform',
    };
    return html`
        <div id="imageViewer" onClick=${removeImageViewer} onWheel=${event => event.preventDefault()}>
            <div id="iv_header" onClick=${event => event.stopPropagation()}>
                <div style="flex:1;">Image Viewer</div>
                <div style="display:flex;filter:invert(1);gap:8px;margin-right:8px;">
                    <button id="rotate_left" type="button" style="cursor:pointer;" aria-label="Rotate left"
                        dangerouslySetInnerHTML=${{ __html: SVG.TURN_DEG }}
                        onClick=${() => setTransform(current => ({ ...current, rotate: current.rotate - 90 }))} />
                    <button id="rotate_right" type="button" style="transform:scaleX(-1);cursor:pointer;"
                        aria-label="Rotate right" dangerouslySetInnerHTML=${{ __html: SVG.TURN_DEG }}
                        onClick=${() => setTransform(current => ({ ...current, rotate: current.rotate + 90 }))} />
                </div>
                <button id="iv_close" type="button" aria-label="Close image viewer"
                    dangerouslySetInnerHTML=${{ __html: SVG.CLOSE }} onClick=${removeImageViewer} />
            </div>
            <section ref=${sectionRef} onWheel=${zoomAt}>
                <div id="iv_transform" style=${translateStyle}>
                    <div id="iv_rotate" style=${rotateStyle}>
                        <img id="iv_image" src=${imageUrl} alt="" draggable=${false}
                            style=${`cursor:${transform.scale === 1 ? 'zoom-in' : 'grab'};`}
                            onClick=${toggleZoom} onMouseDown=${startDragging}
                            onDragStart=${event => event.preventDefault()}
                            onDrop=${event => event.preventDefault()} />
                    </div>
                </div>
            </section>
        </div>
    `;
}
