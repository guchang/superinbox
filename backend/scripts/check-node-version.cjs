#!/usr/bin/env node

const major = Number.parseInt(process.versions.node.split(".")[0], 10);

const isSupported = Number.isInteger(major) && major >= 18 && major <= 22;

if (isSupported) {
  process.exit(0);
}

const message = [
  "",
  "Unsupported Node.js version for backend dependencies.",
  `Current: v${process.versions.node}`,
  "Required: Node.js 18, 20, or 22 (LTS).",
  "",
  "Fix with nvm:",
  "  nvm install 22",
  "  nvm use 22",
  "  npm install",
  "",
].join("\n");

console.error(message);
process.exit(1);
