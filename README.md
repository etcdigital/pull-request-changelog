# Github Action PR Changelog Generator

Github action that creates a changelog on opening or updating the PR.

## Dependencies

To use this action, you need to use it together with `action/checkout` from github.
We need that to access git changes. See usage example under.

## How it works

Whenever you open a PR to `master` branch, action will compare `master` branch with your branch and
post a comment to PR with all the changes that are going to be merged to `master` branch.

There are a few assumptions that you should be aware, when you're using this action.

## How use

Create a file `.github/workflows/changelog.yml` with:

```yml
name: Changelog Generator
on:
  pull_request:
    branches:
      - master
    types: [opened, reopened, synchronize]

jobs:
  changelog:
    name: Chanegelog Generator
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: etcdigital/pull-request-changelog@1.0
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

[See the result...](https://github.com/etcdigital/pull-request-changelog/pull/1#issuecomment-625586295)
