import { afterEach, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { selectPython } from '../lib/python-analysis';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn(), spawn: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

it('skips broken virtual environments and finds a working Python', () => {
  vi.stubEnv('SENTINEL_PYTHON', '');
  vi.stubEnv('VIRTUAL_ENV', '');
  vi.mocked(spawnSync).mockImplementation(((command: string) => command === 'python'
    ? { status: 0, stdout: 'Python 3.12.2', stderr: '' }
    : { status: 1, stdout: '', stderr: 'No Python' }) as typeof spawnSync);
  expect(selectPython('/project')).toBe('python');
});

it('honors an explicit interpreter and does not silently use another', () => {
  vi.stubEnv('SENTINEL_PYTHON', 'chosen-python');
  vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: 'Python 3.12.2', stderr: '' } as ReturnType<typeof spawnSync>);
  expect(selectPython('/project')).toBe('chosen-python');
  expect(spawnSync).toHaveBeenCalledOnce();
});

it('reports a broken explicit interpreter clearly', () => {
  vi.stubEnv('SENTINEL_PYTHON', 'broken-python');
  vi.mocked(spawnSync).mockReturnValue({ status: 1, stdout: '', stderr: 'No Python' } as ReturnType<typeof spawnSync>);
  expect(() => selectPython('/project')).toThrow('SENTINEL_PYTHON does not point to a working Python');
});
