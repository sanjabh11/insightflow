/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1', // Adjust if your path aliases are different
  },
  // Automatically clear mock calls, instances and results before every test
  clearMocks: true,
};
