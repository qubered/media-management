module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Keep the subject line skimmable in `git log --oneline`.
    "header-max-length": [2, "always", 100],
  },
};
