# CI guide

Workflows live in `.github/workflows`. Every third-party action is pinned to a full commit SHA,
with the version in a comment. Container images are pinned by digest in `docker/` and
`local-app/Dockerfile`. Dependabot (`.github/dependabot.yml`) proposes updates for npm, GitHub
Actions, Dockerfiles and Compose.

## `CI` (`ci.yml`)

Runs on pushes to `main`, pull requests, a weekly schedule and on demand.

| Job                                         | What it proves                                                                                                                                                 | Artifacts                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Static quality**                          | lockfile integrity, `typecheck`, `lint`, `format:check`, config validation (`prod` passes, unconfigured `local` fails), `git diff --check` over the whole tree | —                                                                           |
| **Framework self-tests + coverage**         | `npm run test:coverage`: all self-tests, coverage gate on the framework core                                                                                   | `coverage`, `allure-results-framework`, `test-results-framework` on failure |
| **Scenarios (api / ui / db / integration)** | each project on its own isolated local stand                                                                                                                   | `allure-results-<project>` always, `test-results-<project>` on failure      |
| **Concurrent stand isolation**              | two complete stands at once, both green                                                                                                                        | —                                                                           |
| **CodeQL**                                  | `javascript-typescript` and `actions`, `security-and-quality` queries                                                                                          | code scanning alerts                                                        |
| **Dependency review**                       | pull requests only, fails on moderate or higher advisories                                                                                                     | PR comment on failure                                                       |
| **Quality gate**                            | aggregates every job above; the only check branch protection needs                                                                                             | —                                                                           |
| **Allure report** → **Publish report**      | `main` only, even when scenarios fail: merges raw results from all jobs, restores history from the published site, deploys to GitHub Pages                     | Pages site                                                                  |

Raw Allure results are uploaded with `if: always()`, so a failing scenario job still contributes to
the merged report.

### Coverage gate

`.c8rc.json` measures the framework core: config, diagnostics, teardown, test data, waiting,
response contracts, SSH tunnel and database lifecycle, reporting, UI diagnostics and the core
fixtures. Thresholds: 90 % lines, statements and functions, 85 % branches. Domain clients, page
objects and repositories are excluded on purpose. Product scenarios exercise them against real
targets, and covering them with mocks would only duplicate those scenarios.

## `Release` (`release.yml`)

Triggered by a tag `v<semver>`:

1. the tag must equal `package.json` `version`;
2. `CHANGELOG.md` must contain `## [<version>] - YYYY-MM-DD`. The section is extracted and
   linted: only Keep a Changelog headings, at least one bullet, and no bullet that repeats its
   heading (`### Added` → `- Added Added …`);
3. static checks, self-tests with the coverage gate, and the complete local suite
   (`npm run stand:local -- npx playwright test`);
4. `gh release create` with the extracted notes.

To cut a release:

```bash
npm version 0.2.0 --no-git-tag-version   # bump package.json + lockfile
# move the Unreleased entries into "## [0.2.0] - <today>" in CHANGELOG.md, commit, then:
git tag v0.2.0 && git push origin main v0.2.0
```

## Repository settings

These settings live on GitHub, not in the repository. A maintainer applies them once:

- **Pages:** Settings → Pages → Source: **GitHub Actions**. Without it, the `Publish report` job
  fails. The report is then served at `https://<owner>.github.io/<repo>/`.
- **Branch protection for `main`:** require a pull request, require status checks to pass, and
  require the single check **`Quality gate`**. Also require branches to be up to date, and
  disallow force pushes and deletions.
- **Code scanning:** CodeQL results appear under Security → Code scanning. No extra setup is
  needed for public repositories.
- **Dependabot alerts and security updates:** enable them under Settings → Code security.
