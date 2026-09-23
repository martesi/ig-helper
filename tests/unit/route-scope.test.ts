import { expect, test } from 'bun:test';
import { RouteScope } from '../../src/shared/route-scope.ts';

test('closing a route scope cancels its timers and runs registered cleanup', async () => {
    const scope = new RouteScope();
    let timerCalls = 0;
    let cleanupCalls = 0;

    scope.setTimeout(() => { timerCalls += 1; }, 20);
    scope.setInterval(() => { timerCalls += 1; }, 5);
    scope.defer(() => { cleanupCalls += 1; });
    scope.close();

    await new Promise(resolve => setTimeout(resolve, 30));
    expect(scope.active).toBe(false);
    expect(timerCalls).toBe(0);
    expect(cleanupCalls).toBe(1);
});
