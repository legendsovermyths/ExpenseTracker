// Unit tests for pure TypeScript helpers (no React Native runtime).
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/?(*.)test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/ios/", "/android/", "/sdk/"],
  transform: { "^.+\\.ts$": ["babel-jest", { presets: [["@babel/preset-typescript"], ["@babel/preset-env", { targets: { node: "current" } }]] }] },
};
