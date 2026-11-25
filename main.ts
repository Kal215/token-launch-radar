import { cpSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-board.ts';
import { boardIssue, buildBoard, buildRadar, parseSnapshot } from './lib/model.ts';

const repositoryDirectory = fileURLToPath(new URL('.', import.meta.url));

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a path`);
  return value;
}

function inputFile(args: string[]): string {
  const configured = option(args, '--input') ?? process.env.MAKEFUN_INPUT_DIR ?? '/input';
  const path = resolve(configured);
  try {
    const stat = statSync(path);
    return stat.isDirectory() ? join(path, 'snapshot.json') : path;
  } catch (error) {
    throw new Error(`cannot access input "${path}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

function run(): void {
  const args = process.argv.slice(2);
  const inputPath = inputFile(args);
  const outputPath = resolve(option(args, '--output') ?? process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
  let snapshot;
  try {
    snapshot = parseSnapshot(JSON.parse(readFileSync(inputPath, 'utf8')) as unknown);
  } catch (error) {
    throw new Error(`could not read snapshot: ${error instanceof Error ? error.message : String(error)}`);
  }

  const rows = buildBoard(snapshot);
  const issue = boardIssue(snapshot, rows);
  if (issue !== null) throw new Error(`board refused: ${issue}`);
  const radar = buildRadar(snapshot);

  mkdirSync(outputPath, { recursive: true });
  writeFileSync(join(outputPath, 'board.json'), `${JSON.stringify({ rows }, null, 2)}\n`);
  writeFileSync(join(outputPath, 'data.js'), `window.RADAR=${JSON.stringify(radar)};\n`);
  cpSync(resolve(repositoryDirectory, 'dashboard'), join(outputPath, 'dashboard'), { recursive: true });
  cpSync(resolve(repositoryDirectory, 'screenshots'), join(outputPath, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outputPath, {
    text_max_bytes: 65536,
    screenshots: { max: 4, max_bytes: 524288 },
    dashboard: { max_files: 400, max_bytes: 4194304 },
  });
  writeFileSync(join(outputPath, 'dossier.json'), dossier);
  console.log(`Built ${rows.length} ranked protocols (${snapshot.watchlist.length} watchlist), ${radar.live_rows.length} live-token records; dossier ${(dossier.length / 1024).toFixed(1)} KiB.`);
}

try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}