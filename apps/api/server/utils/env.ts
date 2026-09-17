// Side-effect load so ENV is initialized outside `varlock run` (tests, typecheck imports).
// oxlint-disable-next-line import/no-unassigned-import
import 'varlock/auto-load';
export { ENV } from '../../env.ts';
