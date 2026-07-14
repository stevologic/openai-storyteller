import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from './generate';

describe('bounded generation queue', () => {
  it('limits simultaneous provider requests while preserving results', async () => {
    let active = 0;
    let maximumActive = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return item * 2;
    });

    expect(maximumActive).toBe(2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it('does not begin more queued billable work after a task fails', async () => {
    const started: number[] = [];
    await expect(
      mapWithConcurrency([0, 1, 2, 3], 2, async (item) => {
        started.push(item);
        if (item === 0) throw new Error('provider failed');
        await Promise.resolve();
        return item;
      }),
    ).rejects.toThrow('provider failed');

    expect(started).toEqual([0, 1]);
  });
});
