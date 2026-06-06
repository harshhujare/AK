import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    // Map the shared package alias used in tests
    '^@ajitsir/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    // Map Next.js path aliases
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Relax some constraints for tests
          strict: true,
          esModuleInterop: true,
          jsx: 'react',
        },
      },
    ],
  },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
  ],
  // Run scoped tests via CLI: npx jest --testPathPatterns="accessControl"
  collectCoverageFrom: [
    'features/**/*.ts',
    'features/**/*.tsx',
    'components/**/*.tsx',
    '!**/__tests__/**',
    '!**/*.d.ts',
  ],
};

export default config;
