export const preset = 'ts-jest';
export const testEnvironment = 'node';
export const moduleNameMapper = {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^obsidian$': '<rootDir>/tests/mocks/obsidian.ts'
};
export const transform = {
    '^.+\\.tsx?$': ['ts-jest', {
        tsconfig: {
            // Add esModuleInterop to resolve TS warnings
            esModuleInterop: true,
        }
    }]
};
export const testRegex = '(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$';
export const moduleFileExtensions = ['ts', 'tsx', 'js', 'jsx', 'json', 'node'];
export const collectCoverage = true;
export const coverageDirectory = 'coverage';
export const coverageReporters = ['text', 'lcov'];
export const verbose = true;
export const setupFilesAfterEnv = ['<rootDir>/tests/setup.ts']; 