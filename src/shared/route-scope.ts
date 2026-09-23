import { Effect, Fiber } from 'effect';

type Cleanup = () => void;

export class RouteScope {
    readonly #cleanups = new Set<Cleanup>();
    #closed = false;
    readonly #fiber: Fiber.Fiber<never>;

    constructor() {
        const lifetime = Effect.acquireRelease(
            Effect.void,
            () => Effect.sync(() => this.dispose()),
        ).pipe(Effect.flatMap(() => Effect.never));
        this.#fiber = Effect.runFork(Effect.scoped(lifetime));
    }

    get active(): boolean {
        return !this.#closed;
    }

    defer(cleanup: Cleanup): Cleanup {
        if (this.#closed) {
            cleanup();
            return () => {};
        }
        this.#cleanups.add(cleanup);
        return () => this.#cleanups.delete(cleanup);
    }

    setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
        let unregister: Cleanup = () => {};
        const timer = setTimeout(() => {
            unregister();
            if (this.active) callback();
        }, delay);
        unregister = this.defer(() => clearTimeout(timer));
        return timer;
    }

    setInterval(callback: () => void, delay: number): ReturnType<typeof setInterval> {
        const timer = setInterval(() => {
            if (this.active) callback();
        }, delay);
        this.defer(() => clearInterval(timer));
        return timer;
    }

    observe(observer: MutationObserver, target: Node, options: MutationObserverInit): void {
        if (!this.active) return;
        observer.observe(target, options);
        this.defer(() => observer.disconnect());
    }

    close(): void {
        this.dispose();
        Effect.runFork(Fiber.interrupt(this.#fiber));
    }

    private dispose(): void {
        if (this.#closed) return;
        this.#closed = true;
        for (const cleanup of [...this.#cleanups].reverse()) cleanup();
        this.#cleanups.clear();
    }
}

let current: RouteScope | undefined;
const subscribers = new Set<(scope: RouteScope) => void>();

export function currentRouteScope(): RouteScope {
    return current ?? beginRouteScope();
}

export function beginRouteScope(): RouteScope {
    current?.close();
    current = new RouteScope();
    for (const subscriber of subscribers) subscriber(current);
    return current;
}

export function subscribeRouteScope(subscriber: (scope: RouteScope) => void): Cleanup {
    subscribers.add(subscriber);
    subscriber(currentRouteScope());
    return () => subscribers.delete(subscriber);
}
