import { h, render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ControlBar, IconButton } from '../ui/components.jsx';
import { RotateCcwIcon, RotateCwIcon, XIcon } from '../ui/icons.jsx';
import { createOwnedUiRoot, getOwnedUiMount } from '../ui/shadow.js';

const VIEWER_ROOT_ID = 'ig-helper-image-viewer-root';

export function openImageViewer(imageUrl) {
    removeImageViewer();
    const { host, mount } = createOwnedUiRoot(VIEWER_ROOT_ID);
    Object.assign(host.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '600001',
        overflow: 'hidden',
    });
    render(<ImageViewer imageUrl={imageUrl} />, mount);
}

export function removeImageViewer() {
    const root = document.getElementById(VIEWER_ROOT_ID);
    const mount = getOwnedUiMount(VIEWER_ROOT_ID);
    if (!root || !mount) return;
    render(null, mount);
    root.remove();
}

function ImageViewer({ imageUrl }) {
    const sectionRef = useRef(null);
    const transformRef = useRef(null);
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
        const rect = transformRef.current.getBoundingClientRect();
        setTransform(current => {
            const scale = requestedScale ?? Math.min(5, Math.max(1,
                current.scale + (event.deltaY < 0 ? 0.1 : -0.1) * current.scale));
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const ratio = scale / current.scale;
            return {
                ...current,
                scale,
                x: current.x + mouseX * (1 - ratio),
                y: current.y + mouseY * (1 - ratio),
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

    return (
        <div id="imageViewer" class="ig-helper-ui" onClick={removeImageViewer} onWheel={event => event.preventDefault()}>
            <ControlBar id="iv_header" onClick={event => event.stopPropagation()}>
                <IconButton id="rotate_left" icon={RotateCcwIcon} label="Rotate left"
                    onClick={() => setTransform(current => ({ ...current, rotate: current.rotate - 90 }))} />
                <IconButton id="rotate_right" icon={RotateCwIcon} label="Rotate right"
                    onClick={() => setTransform(current => ({ ...current, rotate: current.rotate + 90 }))} />
                <IconButton id="iv_close" icon={XIcon} label="Close image viewer" onClick={removeImageViewer} />
            </ControlBar>
            <section ref={sectionRef} onWheel={zoomAt}>
                <div ref={transformRef} id="iv_transform" style={translateStyle}>
                    <div id="iv_rotate" style={rotateStyle}>
                        <img id="iv_image" src={imageUrl} alt="" draggable={false}
                            style={{ cursor: transform.scale === 1 ? 'zoom-in' : 'grab' }}
                            onClick={toggleZoom} onMouseDown={startDragging}
                            onDragStart={event => event.preventDefault()}
                            onDrop={event => event.preventDefault()} />
                    </div>
                </div>
            </section>
        </div>
    );
}
