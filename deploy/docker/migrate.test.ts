import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vite-plus/test';

const temporaryDirectories: string[] = [];

type MigrationFixture = {
  directory: string;
  logFile: string;
  migrationChecksum: string;
  scriptPath: string;
};

function createFixture(migrationName = '20260917000000_example'): MigrationFixture {
  const directory = mkdtempSync(join(tmpdir(), 'stampp-migrate-'));
  temporaryDirectories.push(directory);
  const migrationsDirectory = join(directory, 'migrations');
  const migrationDirectory = join(migrationsDirectory, migrationName);
  const binaryDirectory = join(directory, 'bin');
  const migrationSql = 'CREATE TABLE example (id text PRIMARY KEY);\n';
  const logFile = join(directory, 'psql.log');
  mkdirSync(migrationDirectory, { recursive: true });
  mkdirSync(binaryDirectory);
  writeFileSync(join(migrationDirectory, 'migration.sql'), migrationSql);
  const fakePsql = join(binaryDirectory, 'psql');
  writeFileSync(
    fakePsql,
    `#!/bin/sh
for argument in "$@"; do
  case "$argument" in
    --command=*)
      printf '%s' "\${APPLIED_CHECKSUM:-}"
      exit 0
      ;;
  esac
done
cat >> "$PSQL_LOG"
`,
    { mode: 0o755 },
  );
  return {
    directory: migrationsDirectory,
    logFile,
    migrationChecksum: createHash('sha256').update(migrationSql).digest('hex'),
    scriptPath: join(import.meta.dirname, 'migrate.sh'),
  };
}

function migrationEnvironment(fixture: MigrationFixture, appliedChecksum = ''): NodeJS.ProcessEnv {
  return {
    ...process.env,
    APPLIED_CHECKSUM: appliedChecksum,
    MIGRATIONS_DIR: fixture.directory,
    PATH: `${join(fixture.directory, '..', 'bin')}:${process.env.PATH ?? ''}`,
    PGDATABASE: 'stampp',
    PGHOST: 'db',
    PGPASSWORD: 'secret',
    PGPORT: '5432',
    PGUSER: 'stampp',
    PSQL_LOG: fixture.logFile,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('migrate.sh', () => {
  it('applies an unseen migration and records its checksum in the same transaction input', () => {
    const fixture = createFixture();
    execFileSync('/bin/sh', [fixture.scriptPath], {
      env: migrationEnvironment(fixture),
    });

    const input = readFileSync(fixture.logFile, 'utf8');
    expect(input).toContain('CREATE TABLE IF NOT EXISTS stampp_migrations');
    expect(input).toContain('CREATE TABLE example (id text PRIMARY KEY);');
    expect(input).toContain(`VALUES ('20260917000000_example', '${fixture.migrationChecksum}')`);
  });

  it('skips a migration whose recorded checksum still matches', () => {
    const fixture = createFixture();
    execFileSync('/bin/sh', [fixture.scriptPath], {
      env: migrationEnvironment(fixture, fixture.migrationChecksum),
    });

    const input = readFileSync(fixture.logFile, 'utf8');
    expect(input).toContain('CREATE TABLE IF NOT EXISTS stampp_migrations');
    expect(input).not.toContain('CREATE TABLE example');
    expect(input).not.toContain('INSERT INTO stampp_migrations');
  });

  it('fails before applying a migration changed after its first run', () => {
    const fixture = createFixture();
    const result = spawnSync('/bin/sh', [fixture.scriptPath], {
      encoding: 'utf8',
      env: migrationEnvironment(fixture, 'different-checksum'),
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('changed after it was applied');
    expect(readFileSync(fixture.logFile, 'utf8')).not.toContain('CREATE TABLE example');
  });

  it('rejects migration directory names that cannot be safely recorded', () => {
    const fixture = createFixture("unsafe'name");
    const result = spawnSync('/bin/sh', [fixture.scriptPath], {
      encoding: 'utf8',
      env: migrationEnvironment(fixture),
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Migration directory has an invalid name');
    expect(readFileSync(fixture.logFile, 'utf8')).not.toContain('CREATE TABLE example');
  });
});
