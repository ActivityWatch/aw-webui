// Manages modules

import { promises as fs } from 'fs';
import { constants as fs_constants } from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

// TODO: Make configurable via better CLI
const TESTING = process.argv.includes('--testing');
if (TESTING) {
  console.log('Running in testing mode');
}

/**
 * @param {string} exe executable name (without extension if on Windows)
 * @return {Promise<string|null>} executable path if found
 * From: https://abdus.dev/posts/checking-executable-exists-in-path-using-node/
 * */
async function findExecutable(exe: string): Promise<string | null> {
  const envPath = process.env.PATH || '';
  const envExt = process.env.PATHEXT || '';
  const pathDirs = envPath.replace(/["]+/g, '').split(path.delimiter).filter(Boolean);
  const extensions = envExt.split(';');
  const candidates = pathDirs.flatMap(d => extensions.map(ext => path.join(d, exe + ext)));
  try {
    return await Promise.any(candidates.map(checkFileExists));
  } catch (e) {
    return null;
  }

  async function checkFileExists(filePath) {
    if ((await fs.stat(filePath)).isFile()) {
      return filePath;
    }
    throw new Error('Not a file');
  }
}

class Module {
  name: string;
  path: string;
  process: ChildProcess | null;

  constructor(name: string, _path: string) {
    this.name = name;
    this.path = _path;
  }

  start() {
    // Start the module
    try {
      console.log(`Starting ${this.name}` + (TESTING ? ' (in testing mode)' : ''));

      const args = [];
      if (TESTING) args.push('--testing');

      this.process = spawn(this.path, args);
      this.process.on('close', code => {
        console.log(`Module ${this.name} exited with code ${code}`);
      });
      this.process.stdout.on('data', d => console.log(`stdout: ${d}`));
      this.process.stderr.on('data', d => console.error(`stderr: ${d}`));
    } catch (err) {
      console.error(`ERROR ${this.name}: ${err}`);
    }
  }

  stop() {
    // Stop the module
    if (this.running()) {
      this.process.kill();
    } else {
      console.warn("Module wasn't running, cannot stop.");
    }
  }

  toggle() {
    if (this.running()) {
      this.stop();
    } else {
      this.start();
    }
  }

  running() {
    if (this.process.signalCode === null) return true;
    else return false;
  }
}

export class Manager {
  modules: Module[];
  to_autostart: string[];

  constructor(autostart: string[]) {
    this.to_autostart = autostart;
  }

  async init(): Promise<void> {
    // Stuff that needs async init
    this.modules = [].concat(
      (
        await Promise.all([
          //this.discoverModules(path.join(__dirname, '../..')),
          this.discoverModules('/opt/activitywatch'),
        ])
      ).flat()
    );
  }

  async start(name: string): Promise<void> {
    // Start a specific module, by name
    const mod = this.modules.find(m => m.name == name);
    if (mod) {
      await mod.start();
    } else {
      console.error(`Module ${name} could not be started`);
    }
  }

  async autostart(): Promise<void> {
    // Start modules that should autostart
    console.log(`Autostarting modules: ${this.to_autostart}`);

    // Start servers first
    await Promise.all(
      this.to_autostart
        .filter(mod => mod.includes('aw-server'))
        .map(async server => {
          await this.start(server);
        })
    );

    // Start the rest of the modules
    await Promise.all(
      this.to_autostart
        .filter(name => !name.includes('aw-server'))
        .map(async (name, _idx) => {
          await this.start(name);
        })
    );
  }

  private async discoverModules(dir: string): Promise<Module[]> {
    // Check all files in directory, and return executables that look executable
    const modules: Module[] = [];
    try {
      const files = await fs.readdir(dir);
      await Promise.all(
        files
          .filter(file => !file.includes('.so') && !file.includes('.jxa'))
          .map(async file => {
            const filepath = path.join(dir, file);
            const stat = await fs.stat(filepath);
            if (stat.isFile()) {
              const is_exec = await fs
                .access(filepath, fs_constants.X_OK)
                .then(() => true)
                .catch(() => false);

              if (is_exec) {
                console.log(`Found executable module ${file}`);
                modules.push(new Module(file, filepath));
              }
            } else if (stat.isDirectory()) {
              // Recurse
              modules.push(...(await this.discoverModules(filepath)));
            } else {
              console.warn('Not a file, and not a dir?');
            }
          })
      );
    } catch (err) {
      console.error('Could not list the directory.', err);
    }
    return modules;
  }
}

export const manager = new Manager(['aw-server-rust', 'aw-watcher-window', 'aw-watcher-afk']);
