/*
 * AI-generated code: 80% (tool: ChatGPT; Jest configuration setup for React/Vite project)
 * Human code: 20% (verified settings match project structure and test requirements)
 */

module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.js"],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "<rootDir>/__mocks__/fileMock.js",
  },
};
