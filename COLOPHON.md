# Colophon

How this repository was made: which tools did the work, where they ran, what
each contributed, and who directed it. License and third-party notices live
elsewhere.

## Snapshot

| | |
|---|---|
| Project | Mr. Bill: a small local Node.js tool that turns pasted bill text into a Basecamp to-do |
| Primary builder | Unknown |
| Surface | Unknown |
| Model / mode | Unknown for the build. (At runtime, `bill.js` calls `claude-haiku-4-5-20251001` to parse bills. That is a model the tool uses, configured in code, not evidence of what built the tool) |
| Editor | Unknown |
| Review | Unknown |
| Directed by | Ron Stauffer, per the Git identity on both commits; not otherwise confirmed |
| Human owner | Ron Stauffer; his role beyond committing is not recorded |
| Era | 2026-04-21 to 2026-05-14 (dates as recorded in the commits, UTC−07:00) |
| Status | Unknown |

## How the work was done

Git history has two commits, both under Ron Stauffer's Git identity, with no
AI trailers. The first (April 21, 2026) added the OAuth flow, Basecamp helpers,
and the bill parser. The second (May 14, 2026) moved secrets out of the project
folder, rewrote the README, and bumped the version to 0.2.0. Which tools or
models wrote the code, and how it was reviewed or tested, is not recorded.

## Builder history (newest first)

| Date | Builder | Role | Surface | Model / mode | Contribution | Evidence |
|---|---|---|---|---|---|---|
| 2026-11-05 | Claude Code | Documented | Cloud session | Claude Opus 5.5 (configured for the session; the serving model was not independently verified) | Reconstructed this colophon from the repository; no code changed | Observed in session; `git log -- COLOPHON.md` |
| 2026-05-14 | Unknown; committed by Ron Stauffer's Git identity | Built | Unknown | Unknown | Security and maintainability refactor: secrets moved to the shell environment and `~/.mr-bill/tokens.json`, README rewritten, version 0.2.0 | Commit `9e49467` |
| 2026-04-21 | Unknown; committed by Ron Stauffer's Git identity | Built | Unknown | Unknown | Initial commit: OAuth authorization, Basecamp helpers, bill parser, test to-do script | Commit `9dcb74f` |

## Evidence limits

- This file follows COLOPHON.md instructions version 1.1.2, in forensic mode.
- Inspected: the full Git history (two commits, one branch of work), commit
  messages and diffs, `README.md`, `package.json`, `.gitignore`, and the source
  files. Neither commit has a `Co-Authored-By` or other AI trailer. A missing
  trailer does not prove a person wrote the change alone.
- There is no `CLAUDE.md`, `AGENTS.md`, `.cursor/` folder, `CREDITS.md`, or
  other AI config or provenance file in the repository.
- A commit's author is the Git identity that made the commit, not necessarily
  the person or tool that wrote the change. The builders of both commits are
  therefore Unknown.
- The README says the original planning for this tool is in a separate
  `lotflow` repository. That repository was not inspected, and a linked
  repository is not evidence about this one.
- This reconstruction ran in a fresh cloud container that holds no session
  logs from earlier work. Session logs, if any, stay on the computers where the
  work happened; running the same pass on those computers may fill gaps.
