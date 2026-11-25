import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';

export function selectPython(root: string): string {
  const explicit = process.env.SENTINEL_PYTHON;
  const candidates = explicit ? [explicit] : [
    ...(process.env.VIRTUAL_ENV ? [path.join(process.env.VIRTUAL_ENV, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')] : []),
    path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'),
    path.join(root, '.venv-1', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'),
    'python', 'python3',
  ];
  for (const candidate of [...new Set(candidates)]) {
    const probe = spawnSync(candidate, ['--version'], { windowsHide: true, timeout: 3000, encoding: 'utf8' });
    if (!probe.error && probe.status === 0 && /Python 3\./.test(probe.stdout + probe.stderr)) return candidate;
  }
  throw new Error(explicit
    ? 'SENTINEL_PYTHON does not point to a working Python. In your working VS Code terminal, run python --version, then set $env:SENTINEL_PYTHON = (Get-Command python).Source and restart npm run dev.'
    : 'No working Python was found. The project virtual environments may point to a removed installation. Start this server from the VS Code terminal where python transcription.py worked, or set SENTINEL_PYTHON to that terminal’s Python path.');
}

export function runPythonAnalysis(payload: unknown, root: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const python = selectPython(root);
    const child = spawn(python, [path.join(root, 'analysis_worker.py')], {
      cwd: root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    let failed = false;
    const timer = setTimeout(() => {
      failed = true;
      child.kill();
      reject(new Error('Analysis timed out. The first Whisper download can take several minutes; retry after checking the local Python setup.'));
    }, 600_000);
    child.on('error', () => {
      clearTimeout(timer);
      reject(new Error('Cannot start Python. Start npm from your activated Python environment or set SENTINEL_PYTHON to a working python.exe.'));
    });
    child.stdout.on('data', chunk => {
      output += chunk.toString();
      if (output.length > 1_000_000) { failed = true; child.kill(); }
    });
    child.stderr.on('data', () => { /* Drain model logs without exposing secrets to the browser. */ });
    child.stdin.on('error', () => {});
    child.on('close', code => {
      clearTimeout(timer);
      if (failed) { reject(new Error('Analysis stopped before completion.')); return; }
      if (code !== 0) { reject(new Error('Python analysis could not start. Install the parent project requirements using the same Python used to start this app.')); return; }
      try { resolve(JSON.parse(output.trim().split('\n').at(-1) || '{}')); }
      catch { reject(new Error('Python returned an invalid analysis response.')); }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}
