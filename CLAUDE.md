# CLAUDE.md

Guide Claude Code (claude.ai/code) for work in repo.

Shared guide for all coding agents: `AGENTS.md`, imported below. Agent-wide instructions go there. Only Claude Code specifics here.

@AGENTS.md

## Claude Code specifics

- Playwright MCP screenshots → `.playwright-mcp/` (gitignored), absolute paths.

### Skills, subagents and tools

- Every subagent run `/caveman ultra` whole run, skill-asked or started for speed. Subagent writing/changing code also run `/ponytail full` with Caveman.
- Real-creativity work (e.g. UI redesign) → `/adhd` skill.
- UI redesign: Taste (`design-taste-frontend`) + Impeccable skills with `/adhd`. Unless owner named 2+ liked reference sites, run `/interview-me` to find them, then pull design components via `/extract-design` + other Designlang commands. Add other skills where help.
- Request or stored memory about how people actually use Civil → check PostHog for evidence via PostHog skills.
- All saves to Hindsight compressed with Caveman first, save tokens on Hindsight Cloud account. Uncompressed Hindsight memory/document → compress with Caveman too.
- Functions, variables, other code → look up via JCodeMunch MCP server. Stuff likely deep in Markdown file >50 lines → JDocMunch MCP server.
- Before any Fallow task, check Fallow skills (`fallow`, `fallow-review`, `fallow-setup`, rest) for one covering it; use it.