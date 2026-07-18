import { spawn, type ChildProcess } from 'child_process';
import { readFile, access } from 'fs/promises';
import { join } from 'path';
import type { PackageScripts, ScriptOutput } from '../../shared/types.js';

// Store running processes
const runningProcesses = new Map<string, { process: ChildProcess; output: string[] }>();

export async function getPackageScripts(repoPath: string = process.cwd()): Promise<PackageScripts> {
  try {
    const packageJsonPath = join(repoPath, 'package.json');

    // Check if package.json exists
    await access(packageJsonPath);

    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    // Detect package manager (check for lock files)
    let packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' = 'npm';
    try {
      await access(join(repoPath, 'pnpm-lock.yaml'));
      packageManager = 'pnpm';
    } catch {
      try {
        await access(join(repoPath, 'yarn.lock'));
        packageManager = 'yarn';
      } catch {
        try {
          await access(join(repoPath, 'bun.lockb'));
          packageManager = 'bun';
        } catch {
          // Default to npm
        }
      }
    }

    return {
      scripts: packageJson.scripts || {},
      projectName: packageJson.name || 'unknown',
      packageManager,
    };
  } catch (error) {
    console.error('[NPM Scripts] Failed to read package.json:', error);
    throw new Error('Failed to read package.json');
  }
}

export function runScript(
  scriptName: string,
  repoPath: string = process.cwd(),
  packageManager: string = 'npm'
): string {
  const processId = `${repoPath}:${scriptName}:${Date.now()}`;

  // Kill existing process with same script name
  for (const [id, proc] of runningProcesses.entries()) {
    if (id.startsWith(`${repoPath}:${scriptName}:`)) {
      try {
        proc.process.kill();
      } catch (error) {
        console.error('[NPM Scripts] Failed to kill existing process:', error);
      } finally {
        // Always remove from map, even if kill failed
        runningProcesses.delete(id);
      }
    }
  }

  const pmCommands: Record<string, string> = {
    npm: 'npm',
    pnpm: 'pnpm',
    yarn: 'yarn',
    bun: 'bun',
  };
  const command = pmCommands[packageManager] ?? 'npm';
  // All package managers support "<pm> run <script>"; using the run form avoids
  // ambiguity with built-in subcommands (e.g. `pnpm test` would else run pnpm's
  // own test, not the user script).
  const args = ['run', scriptName];

  // shell: false — scriptName is constrained to [A-Za-z0-9:_-] by the route's
  // zod schema; running through a shell would allow metacharacter injection.
  const childProcess = spawn(command, args, {
    cwd: repoPath,
    shell: false,
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  const processData = {
    process: childProcess,
    output: [] as string[],
  };

  runningProcesses.set(processId, processData);

  childProcess.stdout.on('data', (data: Buffer) => {
    const output = data.toString();
    processData.output.push(output);
    // Limit output size (keep last 100 lines)
    if (processData.output.length > 100) {
      processData.output.shift();
    }
  });

  childProcess.stderr.on('data', (data: Buffer) => {
    const output = `[ERROR] ${data.toString()}`;
    processData.output.push(output);
    if (processData.output.length > 100) {
      processData.output.shift();
    }
  });

  childProcess.on('close', (code: number) => {
    processData.output.push(`\n[Process exited with code ${code}]`);
  });

  childProcess.on('error', (error: Error) => {
    processData.output.push(`\n[Error: ${error.message}]`);
  });

  return processId;
}

export function getScriptOutput(processId: string): ScriptOutput {
  const processData = runningProcesses.get(processId);

  if (!processData) {
    return {
      output: 'Process not found',
      exitCode: null,
      isRunning: false,
    };
  }

  const isRunning = processData.process.exitCode === null;

  return {
    output: processData.output.join(''),
    exitCode: processData.process.exitCode,
    isRunning,
  };
}

export function stopScript(processId: string): { success: boolean; message: string } {
  const processData = runningProcesses.get(processId);

  if (!processData) {
    return { success: false, message: 'Process not found' };
  }

  try {
    processData.process.kill('SIGTERM');

    // Force kill after 2 seconds if still running
    setTimeout(() => {
      if (processData.process.exitCode === null) {
        processData.process.kill('SIGKILL');
      }
    }, 2000);

    runningProcesses.delete(processId);
    return { success: true, message: 'Process stopped' };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to stop process',
    };
  }
}

export function getRunningProcesses(): string[] {
  return Array.from(runningProcesses.keys());
}
