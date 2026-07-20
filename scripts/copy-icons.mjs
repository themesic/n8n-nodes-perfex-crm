// Copies node and credential icons into dist, because tsc only emits JavaScript.
import { cp, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const icons = [
	['nodes/PerfexCrm/perfexCrm.svg', 'dist/nodes/PerfexCrm/perfexCrm.svg'],
	['nodes/PerfexCrm/perfexCrm.dark.svg', 'dist/nodes/PerfexCrm/perfexCrm.dark.svg'],
	['credentials/perfexCrm.svg', 'dist/credentials/perfexCrm.svg'],
	['credentials/perfexCrm.dark.svg', 'dist/credentials/perfexCrm.dark.svg'],
];

for (const [from, to] of icons) {
	await mkdir(dirname(to), { recursive: true });
	await cp(from, to);
}
