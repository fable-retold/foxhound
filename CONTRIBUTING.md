# Contributing to Retold

We welcome contributions to Retold and its modules. This guide covers the expectations and process for contributing.

## Code of Conduct

The Retold community values **empathy**, **equity**, **kindness**, and **thoughtfulness**. We expect all participants to treat each other with respect, assume good intent, and engage constructively. These values apply to all interactions: pull requests, issues, discussions, and code review.

## How to Contribute

### Pull Requests

Pull requests are the preferred method for contributing changes. To submit one:

1. Fork the module repository you want to change
2. Create a branch for your work
3. Make your changes, following the code style of the module you are editing
4. Ensure your changes have test coverage (see below)
5. Open a pull request against the module's main branch

**Submitting a pull request does not guarantee it will be accepted.** Maintainers review contributions for fit, quality, and alignment with the project's direction. A PR may be declined, or you may be asked to revise it. This is normal and not a reflection on the quality of your effort.

### Reporting Issues

If you find a bug or have a feature suggestion, open an issue on the relevant module's repository. Include enough detail to reproduce the problem or understand the proposal.

## Test Coverage

Every commit must include test coverage for the changes it introduces. Retold modules use Mocha in TDD style. Before submitting:

- **Write tests** for any new functionality or bug fixes
- **Run the existing test suite** with `npm test` and confirm all tests pass
- **Check coverage** with `npm run coverage` if the module supports it

Pull requests that break existing tests or lack coverage for new code will not be merged.

## Code Style

Follow the conventions of the module you are working in. The general Retold style is:

- **Tabs** for indentation, never spaces
- **Plain JavaScript** only (no TypeScript)
- **Allman-style braces** (opening brace on its own line)
- **Variable naming:** `pVariable` for parameters, `tmpVariable` for temporaries, `libSomething` for imports

When in doubt, match what the surrounding code does.

## Repository Structure

Each module is its own git repository. The [retold](https://github.com/fable-retold/retold) repository tracks module organization but does not contain module source code. Direct your pull request to the specific module repository where your change belongs.
