/*
 * AI-generated code: 80% (tool: Claude; standard React Testing Library setup
 * and act() warning suppression pattern)
 * Human code: 20% (verified setup matches project structure and test requirements)
 */

import "@testing-library/jest-dom";

const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (args[0]?.includes?.("not wrapped in act")) return;
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});
