// Jest transpiles to CommonJS, where Vite's `import.meta.env` is a syntax
// error. This inline plugin rewrites every `import.meta` to a plain
// `{ env: {} }` stub so the lib/*Api.js modules can be imported and
// unit-tested directly; the API base URL just falls back to its default.
// Vite's own build is unaffected — this config is only used by babel-jest.
function stubImportMeta({ types: t }) {
  return {
    name: "stub-import-meta",
    visitor: {
      MetaProperty(path) {
        path.replaceWith(
          t.objectExpression([
            t.objectProperty(t.identifier("env"), t.objectExpression([])),
          ]),
        );
      },
    },
  };
}

module.exports = {
  presets: [
    [
      "@babel/preset-env",
      { targets: { node: "current" }, modules: "commonjs" },
    ],
    ["@babel/preset-react", { runtime: "automatic" }],
  ],
  plugins: [stubImportMeta],
};
