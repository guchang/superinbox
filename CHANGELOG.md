# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Updated MCP docs across root README (EN/zh-CN), docs index, and package README to make npm usage (`@superinbox/mcp-server`) the default integration path.
- Added version-pinning and local debug MCP config examples, plus troubleshooting guidance for MCP setup.
- Documented `packages/` in CONTRIBUTING and clarified doc-sync expectations for package releases.
- Reworked `cli/README.md` into a concise bilingual (Chinese/English) guide, covering installation, config, commands, interactive behavior, automation examples, and FAQ.
- Exposed CLI documentation in root `README.md` with a new "CLI 工具（配套）" section and direct link to `./cli/README.md`.
- Added a brief CLI introduction in root docs to clarify positioning and quick-start workflow for terminal users.
- Split root project documentation into language-specific files: `README.md` (English) and `README.zh-CN.md` (Chinese), with cross-language links.
- Updated subproject READMEs to bilingual Chinese/English format: `channel-bot/README.md`, `backend/README.md`, `deploy/README.md`, `docs/README.md`.
- Added `web/README.md` as a new bilingual module README for the frontend subproject.

## [0.1.0] - 2026-02-08

### Added
- Initial public release of SuperInbox.
- Multi-channel capture entry points (Web, CLI, API, bot integrations, MCP server path).
- AI-assisted processing flow for classification, information extraction, and summarization.
- Rule-based routing and distribution foundation for downstream platforms.
- One-command startup scripts (`start.sh`, `start.js`) and baseline project documentation.
- Added `CONTRIBUTING.md` with contributor workflow, development commands, PR checklist, and commit rules.
- Added `CODE_OF_CONDUCT.md` using the Contributor Covenant 2.1 template.

[0.1.0]: https://github.com/guchang/superinbox/commit/1ab076f1
