# Github Action PR Changelog Generator

Heavy inspiration [https://github.com/etcdigital/pull-request-changelog](Changelog Generator Github Action) 🖤

Github action that creates a changelog upon PR opening. The changelog will contain all the commit messages grouped by type and change level (major, minor, patch).

## Dependencies

To use this action, you need to use it together with `action/checkout` from github.
We need that to access git changes. See usage example under.

## How it works

Whenever you open a PR to `master` branch, action will compare `master` branch with your branch and
post a comment to PR with all the changes that are going to be merged to `master` branch.

There are a few assumptions that you should be aware, when you're using this action.

## More information

See the action .github/workflows/changelog.yml and pull requests
