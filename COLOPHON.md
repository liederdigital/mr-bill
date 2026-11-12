# Colophon

How this repository was made: which tools did the work, where they ran, what
each contributed, and who directed it. License and third-party notices live
elsewhere.

## Snapshot

| | |
|---|---|
| Project | Mr. Bill: a small local Node.js tool that turns pasted bill text into a Basecamp to-do |
| Primary builder | Unknown for the original tool. The November 2026 public-release hardening was built by the Security Guard · CISO bot (Grok Bot) |
| Surface | Unknown for the original tool. The November 2026 hardening was coordinated through the Grok Bot Mac app and ran on the Grok Bot box |
| Model / mode | Unknown for the original build; not recorded for the November 2026 hardening. (At runtime, `bill.js` calls `claude-haiku-4-5-20251001` to parse bills. That is a model the tool uses, configured in code, not evidence of what built the tool) |
| Editor | Unknown |
| Review | Unknown for the original work. Pull request #2 is for Human review and merge by Ron Stauffer (not yet merged at the time of this update) |
| Directed by | Ron Stauffer (Owner-confirmed for the November 2026 public-release work; earlier direction is known only from his Git identity on the 2026 commits) |
| Human owner | Ron Stauffer; directed the November 2026 public-release review and documentation follow-up (Owner-confirmed). His role on the April and May 2026 commits, beyond the Git identity, is not recorded |
| Era | 2026-04-21 to 2026-11-12 (dates as recorded in the commits, UTC−07:00) |
| Status | Active; being prepared for a public, view-only release |

## How the work was done

Through May 2026, Git history had two commits, both under Ron Stauffer's Git
identity, with no AI trailers. The first (April 21, 2026) added the OAuth flow,
Basecamp helpers, and the bill parser. The second (May 14, 2026) moved secrets
out of the project folder, rewrote the README, and bumped the version to 0.2.0.
Which tools or models wrote that code, and how it was reviewed or tested, is
not recorded.

On November 5, 2026, Claude Code reconstructed this colophon in forensic mode
(pull request #1). Ron Stauffer merged that pull request on November 12, 2026
(merge commit `e501485`). The same day, Ron directed a public-release security
review (Owner-confirmed). The Security Guard · CISO bot, coordinated through
the Grok Bot Mac app, did that hardening on the Grok Bot box, committed as
Security Guard <security@lieder.bot> using the GitHub CLI as
security-guard-lieder, and opened [pull request #2](https://github.com/liederdigital/mr-bill/pull/2)
for Ron to review and merge.

## Builder history (newest first)

| Date | Builder | Role | Surface | Model / mode | Contribution | Evidence |
|---|---|---|---|---|---|---|
| 2026-11-12 | Security Guard · CISO (Grok Bot) | Built | Grok Bot Mac app; work ran on the Grok Bot box; GitHub via the `gh` CLI as security-guard-lieder | not recorded | Public-release hardening: OAuth `state` and loopback callback, token exchange in a POST body, token-file permissions, model-output validation, restoration of `ensureTodoList` and `createTodo`, removal of `dotenv`, unit tests, README privacy and view-only copyright notice, `AGENTS.md`, and this colophon update. Opened [PR #2](https://github.com/liederdigital/mr-bill/pull/2). Ron Stauffer reviews and merges | Observed in this session; branch `security/public-release-hardening`; commits as Security Guard <security@lieder.bot>; Owner-confirmed (Ron asked for the review and this documentation follow-up) |
| 2026-11-12 | Ron Stauffer (Git identity) | Approved | Unknown (GitHub merge of PR #1) | Unknown | Merged [PR #1](https://github.com/liederdigital/mr-bill/pull/1) (COLOPHON.md forensic reconstruction) | Merge commit `e501485` |
| 2026-11-05 | Claude Code | Documented | Cloud session | Claude Opus 5.5 (configured for the session; the serving model was not independently verified) | Reconstructed this colophon from the repository; no code changed | Observed in session; `git log -- COLOPHON.md` |
| 2026-05-14 | Unknown; committed by Ron Stauffer's Git identity | Built | Unknown | Unknown | Security and maintainability refactor: secrets moved to the shell environment and `~/.mr-bill/tokens.json`, README rewritten, version 0.2.0 | Commit `9e49467` |
| 2026-04-21 | Unknown; committed by Ron Stauffer's Git identity | Built | Unknown | Unknown | Initial commit: OAuth authorization, Basecamp helpers, bill parser, test to-do script | Commit `9dcb74f` |

## Evidence limits

- This file follows COLOPHON.md instructions version 1.1.2. The November 5
  entry was written in forensic mode. The November 12 rows were written in
  proactive mode in the same pull request as the work they describe.
- The November 5 reconstruction inspected the history as it then stood (two
  commits, one branch of work), commit messages and diffs, `README.md`,
  `package.json`, `.gitignore`, and the source files. Neither of those commits
  has a `Co-Authored-By` or other AI trailer. A missing trailer does not prove
  a person wrote the change alone. That account is left unchanged.
- As of November 12, 2026, history also includes the COLOPHON commit
  (`b9cc96a`), the merge of PR #1 (`e501485`), and the public-release
  hardening on `security/public-release-hardening` (PR #2). This update
  corrects the earlier "two commits" description, which was accurate on
  November 5 and is not a complete description of the repository now.
- The November 5 reconstruction recorded that there was no `CLAUDE.md`,
  `AGENTS.md`, `.cursor/` folder, `CREDITS.md`, or other AI config or
  provenance file. `AGENTS.md` was added on November 12 in PR #2; the earlier
  statement remains true of the tree as of November 5.
- A commit's author is the Git identity that made the commit, not necessarily
  the person or tool that wrote the change. The builders of the April and May
  2026 commits are therefore still Unknown.
- The November 5 reconstruction noted that the README then pointed at a
  separate `lotflow` repository, which was not inspected. A linked repository
  is not evidence about this one. That README sentence was removed in PR #2
  as an internal-only detail.
- The November 5 reconstruction ran in a fresh cloud container that holds no
  session logs from earlier work. Session logs, if any, stay on the computers
  where the work happened; running the same pass on those computers may fill
  gaps.
- The model used for the November 2026 Security Guard work is not recorded.
  No underlying model name was shown by the tool, found in a config file, or
  confirmed by the owner, and none is invented here.
- PR #2 had not been reviewed or merged at the time of this update. That Ron
  reviews and merges is Owner-confirmed as the intended process, not a record
  that the review has already happened.
