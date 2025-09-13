import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
	// Global ignores - applies to all configurations
	{
		ignores: [
			"node_modules/**",
			"main.js",
			"coverage/**",
			"coverage",
			"scripts/",
			"esbuild.config.mjs",
			"jest.config.js",
			"version-bump.mjs",
			"src/core/VirtualTreeCore.ts",
		],
	},
	// Global settings
	{
		// Disallow inline ESLint config comments and error on unused disables
		linterOptions: {
			noInlineConfig: true,
			reportUnusedDisableDirectives: "error",
		},
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
			"@typescript-eslint/no-explicit-any": "warn", // Optional: discourage any
			"@typescript-eslint/ban-ts-comment": "error",
			"@typescript-eslint/no-unnecessary-type-assertion": "error",
			"@typescript-eslint/consistent-type-assertions": [
				"error",
				{
					assertionStyle: "never",
				},
			],
			"@typescript-eslint/no-empty-function": "warn",
			// Limit console usage to warn/error only
			"no-console": [
				"error",
				{
					allow: ["warn", "error"],
				},
			],
			"max-lines": ["error", { "max": 300, "skipBlankLines": true, "skipComments": true }],
			// Security & themeability: avoid innerHTML/outerHTML and inline styles
			"no-restricted-properties": [
				"error",
				{ "property": "innerHTML", "message": "Avoid innerHTML; use DOM APIs or Obsidian helpers." },
				{ "property": "outerHTML", "message": "Avoid outerHTML; use DOM APIs or Obsidian helpers." }
			],
			"no-restricted-syntax": [
				"error",
				// Using insertAdjacentHTML is similar risk to innerHTML
				{
					"selector": "CallExpression[callee.property.name='insertAdjacentHTML']",
					"message": "Avoid insertAdjacentHTML; use DOM APIs or Obsidian helpers.",
				},
				// Disallow setting inline styles via setAttribute('style', ...)
				{
					"selector": "CallExpression[callee.property.name='setAttribute'][arguments.0.value='style']",
					"message": "Avoid inline styles; prefer CSS classes and stylesheet rules.",
				},
				// Disallow assignments to element.style.* except transform, width, height (allow runtime translateY for virtualization and dynamic sizing)
				{
					"selector": "AssignmentExpression[left.type='MemberExpression'][left.object.type='MemberExpression'][left.object.property.name='style']:not([left.property.name='transform']):not([left.property.name='width']):not([left.property.name='height'])",
					"message": "Avoid setting styles via JavaScript; prefer CSS classes and stylesheet rules (transform, width, height allowed).",
				},
				// Disallow el.style.setProperty(...) except when setting 'transform', 'width', 'height', or CSS custom properties (--*)
				{
					"selector": "CallExpression[callee.property.name='setProperty'][callee.object.property.name='style']:not([arguments.0.value='transform']):not([arguments.0.value='width']):not([arguments.0.value='height']):not([arguments.0.value=/^--/])",
					"message": "Avoid setting styles via JavaScript; prefer CSS classes and stylesheet rules (transform, width, height, and CSS custom properties allowed).",
				},
				// Optional (warn): discourage vault.trash in favor of app.fileManager.trashFile
				{
					"selector": "CallExpression[callee.property.name='trash'][callee.object.property.name='vault']",
					"message": "Use app.fileManager.trashFile(file) to respect user preferences.",
				},
			],
		},
	},
	// Test files: enable Jest globals and relax type-assertion rules
	{
		files: [
			"tests/**/*.ts",
			"tests/**/*.tsx",
			"**/*.test.ts",
			"**/*.test.tsx",
			"**/*.spec.ts",
			"**/*.spec.tsx",
		],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: { sourceType: "module", ecmaVersion: 2020, project: "./tsconfig.json" },
			globals: {
				describe: "readonly",
				test: "readonly",
				expect: "readonly",
				jest: "readonly",
				beforeEach: "readonly",
				afterEach: "readonly",
				beforeAll: "readonly",
				afterAll: "readonly",
			},
		},
		rules: {
			"@typescript-eslint/consistent-type-assertions": "off",
			"@typescript-eslint/no-explicit-any": "warn",
		},
	},
	// View/DOM-heavy code: soften innerHTML/style restrictions to allow performant rendering
	{
		files: [
			"src/virtualTree.ts",
			"src/views/**/*.ts",
			"src/utils/measure.ts",
			"src/settings/**/*.ts",
		],
		rules: {
			"no-restricted-properties": "error",
			"no-restricted-syntax": "error",
			"@typescript-eslint/consistent-type-assertions": "off",
			"@typescript-eslint/ban-ts-comment": "off",
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
				"error",
				{
					allow: ["warn", "error"],
				},
			],
			"no-restricted-properties": [
				"error",
				{ "property": "innerHTML", "message": "Avoid innerHTML; use DOM APIs or Obsidian helpers." },
				{ "property": "outerHTML", "message": "Avoid outerHTML; use DOM APIs or Obsidian helpers." }
			],
			"no-restricted-syntax": [
				"error",
				{ "selector": "CallExpression[callee.property.name='insertAdjacentHTML']", "message": "Avoid insertAdjacentHTML; use DOM APIs or Obsidian helpers." },
				{ "selector": "CallExpression[callee.property.name='setAttribute'][arguments.0.value='style']", "message": "Avoid inline styles; prefer CSS classes and stylesheet rules." },
				{ "selector": "AssignmentExpression[left.type='MemberExpression'][left.object.type='MemberExpression'][left.object.property.name='style']:not([left.property.name='transform']):not([left.property.name='width']):not([left.property.name='height'])", "message": "Avoid setting styles via JavaScript; prefer CSS classes and stylesheet rules (transform, width, height allowed)." },
				{ "selector": "CallExpression[callee.property.name='setProperty'][callee.object.property.name='style']:not([arguments.0.value='transform']):not([arguments.0.value='width']):not([arguments.0.value='height']):not([arguments.0.value=/^--/])", "message": "Avoid setting styles via JavaScript; prefer CSS classes and stylesheet rules (transform, width, height, and CSS custom properties allowed)." },
				{ "selector": "CallExpression[callee.property.name='trash'][callee.object.property.name='vault']", "message": "Use app.fileManager.trashFile(file) to respect user preferences." }
			],
		},
	},
];
