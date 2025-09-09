import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
	{
		ignores: ["node_modules/", "main.js", "coverage/", "scripts/", "esbuild.config.mjs", "jest.config.js", "version-bump.mjs"],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				sourceType: "module",
				ecmaVersion: 2020,
				project: "./tsconfig.json",
			},
		},
		rules: {
			"@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/ban-ts-comment": "warn",
			"@typescript-eslint/no-unnecessary-type-assertion": "warn",
			"@typescript-eslint/consistent-type-assertions": [
				"warn",
				{
					assertionStyle: "never",
				},
			],
			"@typescript-eslint/no-empty-function": "warn",
			"no-console": [
				"warn",
				{
					allow: ["warn", "error"],
				},
			],
			"max-lines": ["warn", { "max": 300, "skipBlankLines": true, "skipComments": true }],
		},
	},
	{
		files: ["**/*.js", "**/*.mjs"],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				sourceType: "module",
				ecmaVersion: 2020,
			},
		},
		rules: {
			"no-console": [
				"warn",
				{
					allow: ["warn", "error"],
				},
			],
		},
	},
	{
		files: ["tests/**/*.ts", "tests/**/*.tsx"],
		rules: {
			"@typescript-eslint/consistent-type-assertions": "off",
		},
	},
];
