## Steps to follow
1. Look at the lint errors in the project (npx eslint . --format=compact), and give a summary of the type of errors and warnings. Give me the list of the files that are causing the errors and warnings.
2. If there are simple / small errors and warnings to fix, start with it, and stop when you are done fixing the simple ones, and check that the build is successful.
3. If you don't find easy to fix errors and warnings, pick one of the error type, in one file, and fix it, then stop, and check that the build is successful. In this case scenario, you must fix at most 1 big error or warning at a time.
4. If you find no errors and warnings to fix, congratulation, you don't need to do anything, simply inform the user that there are no errors and warnings to fix.

## Global guidelines
- When a variable is declared but not used: if it contains a DOM element created with createElement/createEl, keep the creation but remove the variable assignment (e.g., change `const el = parent.createEl('div')` to `parent.createEl('div')` instead of removing the line entirely)
- When facing @typescript-eslint/consistent-type-assertions warnings, here is a snippet that you can use to fix the issue:
```ts
// before
const var = value as Type;
// after
const var = value;
if (var instanceof Type) {
    // rest of the code
}
```