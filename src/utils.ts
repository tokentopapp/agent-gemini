import * as fs from 'fs/promises';
import * as path from 'path';
import { GEMINI_HOME } from './paths.ts';

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export function extractProjectPath(directories: string[] | undefined): string | undefined {
  if (!directories || directories.length === 0) return undefined;
  const first = directories[0]?.trim();
  return first && first.length > 0 ? first : undefined;
}

interface ProjectsFile {
  projects: Record<string, string>;
}

let projectHashToPath: Map<string, string> | null = null;

async function loadProjectMappings(): Promise<Map<string, string>> {
  if (projectHashToPath) return projectHashToPath;
  projectHashToPath = new Map();

  const projectsFile = await readJsonFile<ProjectsFile>(path.join(GEMINI_HOME, 'projects.json'));
  if (!projectsFile?.projects) return projectHashToPath;

  // projects.json maps realPath → alias, but we also need to know
  // which hash directories correspond to which real paths.
  // The alias IS the directory name under tmp/ for aliased projects.
  for (const [realPath, alias] of Object.entries(projectsFile.projects)) {
    projectHashToPath.set(alias, realPath);
  }

  return projectHashToPath;
}

export async function resolveProjectPath(
  directories: string[] | undefined,
  filePath: string,
): Promise<string | undefined> {
  const fromDirectories = extractProjectPath(directories);
  if (fromDirectories) return fromDirectories;

  // Extract the project dir name (hash or alias) from the file path
  // Path format: ~/.gemini/tmp/<projectDir>/chats/<session>.json
  const chatsIdx = filePath.lastIndexOf('/chats/');
  if (chatsIdx === -1) return undefined;

  const projectDirPath = filePath.substring(0, chatsIdx);
  const projectDirName = path.basename(projectDirPath);

  const mappings = await loadProjectMappings();
  const resolved = mappings.get(projectDirName);
  if (resolved) return resolved;

  return undefined;
}
