import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const builtPath = fileURLToPath(new URL('../.output/public/api/v1/openapi.json', import.meta.url));
const snapshotPath = fileURLToPath(new URL('../openapi.snapshot.json', import.meta.url));

if (!existsSync(builtPath)) {
  console.error(
    'Built OpenAPI document not found at %s. Run `vp run --filter api build` first.',
    builtPath,
  );
  process.exit(1);
}

copyFileSync(builtPath, snapshotPath);
console.info('Updated OpenAPI contract snapshot: %s', snapshotPath);
