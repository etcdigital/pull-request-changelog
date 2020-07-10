module.exports = {
  gitPrume:
    "git fetch --no-tags --prune origin +refs/pull/*/head:refs/remotes/origin/pr/*",
  gitNoTag: "git fetch --no-tags origin +refs/heads/*:refs/remotes/origin/*",
  getCommits: (pullRequestId) =>
    `git log --no-merges origin/pr/${pullRequestId} ^origin/master --pretty=oneline --no-abbrev-commit`,
  changeFiles: (sha) => `git diff-tree --no-commit-id --name-only -r ${sha}`,
};
