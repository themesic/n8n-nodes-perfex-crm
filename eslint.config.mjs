import tsParser from '@typescript-eslint/parser';
import * as jsoncParser from 'jsonc-eslint-parser';
import n8nNodesBase from 'eslint-plugin-n8n-nodes-base';
import communityNodes from '@n8n/eslint-plugin-community-nodes';

// Two plugins are used deliberately. eslint-plugin-n8n-nodes-base covers
// parameter naming and ordering, while @n8n/eslint-plugin-community-nodes is
// the one n8n's own scan-community-package runs during verification.
export default [
	{
		ignores: ['dist/**', 'node_modules/**', 'scripts/**'],
	},
	{
		files: ['package.json'],
		languageOptions: { parser: jsoncParser },
		plugins: { 'n8n-nodes-base': n8nNodesBase },
		rules: { ...n8nNodesBase.configs.community.rules },
	},
	{
		files: ['credentials/**/*.ts'],
		languageOptions: { parser: tsParser, parserOptions: { sourceType: 'module' } },
		plugins: { 'n8n-nodes-base': n8nNodesBase },
		rules: {
			...n8nNodesBase.configs.credentials.rules,
			// Core credentials link to n8n's own docs by slug; a community node
			// points at the vendor's documentation, which is a real URL.
			'n8n-nodes-base/cred-class-field-documentation-url-not-http-url': 'off',
			'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
		},
	},
	{
		files: ['nodes/**/*.ts'],
		languageOptions: { parser: tsParser, parserOptions: { sourceType: 'module' } },
		plugins: { 'n8n-nodes-base': n8nNodesBase },
		rules: {
			...n8nNodesBase.configs.nodes.rules,
			// Conflicts with @n8n/community-nodes/node-connection-type-literal,
			// which the official scanner enforces and which wins.
			'n8n-nodes-base/node-class-description-outputs-wrong': 'off',
			'n8n-nodes-base/node-class-description-inputs-wrong-regular-node': 'off',
		},
	},
	communityNodes.configs.recommended,
];
