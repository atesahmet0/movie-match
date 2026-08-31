---
name: posthog-skills-store
description: "Discover, fetch, create, update, and manage centralized agent skills in PostHog via the PostHog MCP tools. Use when managing agent skills, fetching remote team skills from PostHog, creating or editing scouts/skills, or porting local skills."
version: 1.0.0
---

# PostHog Skills Store

Skills are versioned, reusable instructions for AI agents, stored centrally in PostHog and managed in the **[Skills](https://app.posthog.com/skills)** section of the app. Coding agents (Antigravity, Claude Code, Cursor, Codex, Windsurf, etc.) use the PostHog MCP server to access this centralized, versioned skill repository.

---

## PostHog Skills MCP Tools Reference

The PostHog MCP server exposes the skills store through a dedicated family of tools:

| Tool | Purpose | Key Arguments |
| --- | --- | --- |
| `skill-list` | List all available skills (name + description only). Used for discovery. | *(none or filter query)* |
| `skill-get` | Fetch a skill by name – returns the body instructions and a manifest of bundled files. | `skill_name: string` |
| `skill-file-get` | Fetch a single bundled file by path on demand. | `skill_name: string`, `file_path: string` |
| `skill-create` | Store a new skill, optionally with bundled files, metadata, and tool permissions. | `name`, `description`, `body`, `allowed_tools?`, `metadata?`, `files?` |
| `skill-update` | Publish a new version with full body replacement, incremental `edits`, or `file_edits`. | `skill_name`, `base_version`, `body?`, `edits?`, `file_edits?` |
| `skill-file-create` | Add one bundled file to a skill (publishes a new version). | `skill_name`, `path`, `content`, `base_version` |
| `skill-file-delete` | Remove one bundled file from a skill. | `skill_name`, `file_path`, `base_version` |
| `skill-file-rename` | Rename or move one bundled file. | `skill_name`, `old_path`, `new_path`, `base_version` |
| `skill-duplicate` | Duplicate an existing skill under a new name. | `skill_name`, `new_name` |

---

## Core Workflow & Progressive Disclosure

Agents must use **progressive disclosure** to minimize context token overhead:
1. **Discover**: Call `skill-list` to view only skill names and descriptions.
2. **Load Instructions**: Call `skill-get` with the relevant `skill_name` to retrieve the instruction body and bundled file manifest.
3. **Fetch Files On Demand**: Call `skill-file-get` only when a bundled script, template, or reference is specifically required.

---

## How to Create a Skill

### 1. Structure of a Skill
- **Name**: Concise, lowercase kebab-case (e.g. `hog-release-notes`, `movie-match-scout`).
- **Description**: Explains *when* and *why* an agent should pick this skill (critical for agent discovery).
- **Body**: Complete instructions, workflows, output formats, and domain-specific rules.
- **Allowed Tools**: (Optional) List of allowed tools (`["Bash", "Read", "Grep", "Write"]`).
- **Bundled Files**: (Optional) Array of `{ path, content, content_type }`.

### 2. Example `skill-create` Call
```json
{
  "name": "hog-release-notes",
  "description": "Draft release notes from recent git commits and PRs. Use when the user asks to summarize new releases, draft changelog entries, or update release notes.",
  "body": "# Hog Release Notes Writer\n\nYou write clean, approachable release notes for the product...\n\n## Structure\n1. One-line summary\n2. What it does\n3. How to use it\n4. Why we built it\n",
  "allowed_tools": ["Bash", "Read", "Grep"],
  "metadata": { "author": "team", "category": "changelog" }
}
```

---

## How to Update a Skill

Every update creates an immutable version in PostHog. Always fetch the skill first to retrieve the current `base_version`.

### Incremental Edits (Recommended for small changes)
```json
{
  "skill_name": "hog-release-notes",
  "base_version": 1,
  "edits": [
    {
      "old": "## Structure",
      "new": "## Structure (v2)"
    }
  ]
}
```

### Atomic File Operations
- **Add file**: `skill-file-create(skill_name="...", path="scripts/helper.py", content="...", base_version=N)`
- **Delete file**: `skill-file-delete(skill_name="...", file_path="scripts/old.py", base_version=N)`
- **Rename file**: `skill-file-rename(skill_name="...", old_path="scripts/a.py", new_path="scripts/b.py", base_version=N)`

---

## Porting Local Skills to PostHog

To port a local directory-based skill (e.g., `.agents/skills/<name>/` or `~/.claude/skills/<name>/`) into PostHog:
1. Parse `SKILL.md`: Extract YAML frontmatter for `name`, `description`, `allowed_tools`, and metadata; use the markdown body for `body`.
2. Collect subdirectories (`scripts/`, `references/`, `assets/`) as bundled files with relative paths.
3. Submit via `skill-create` to publish version 1 to PostHog.
