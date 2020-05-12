const fetch = require("node-fetch");
const exec = require("@actions/exec");
const github = require("@actions/github");
const core = require("@actions/core");
const makeTemplate = require("./converter");

const pull_request = github.context.payload.pull_request;
const PR_ID = pull_request.number;
const PR_URL = pull_request.html_url;
const URL = pull_request.comments_url;
const GITHUB_TOKEN = core.getInput("token") || process.env.token;

const postToGit = async (url, key, body) => {
  const rawResponse = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `token ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  });
  if (!rawResponse.ok) {
    throw new Error(rawResponse.statusText);
  }
  const content = await rawResponse.json();
  return content;
};

const gitPrume =
  "git fetch --no-tags --prune origin +refs/pull/*/head:refs/remotes/origin/pr/*";
const gitNoTag =
  "git fetch --no-tags origin +refs/heads/*:refs/remotes/origin/*";
const getCommits = `git log --no-merges origin/pr/${PR_ID} ^origin/master --pretty=oneline --no-abbrev-commit`;

/**
 * Action core
 */
(async () => {
  try {
    if (GITHUB_TOKEN === undefined) {
      throw new Error("Missing auth thoken");
    }
    console.log("Generating changelog....");

    await exec.exec(gitPrume);
    await exec.exec(gitNoTag);

    // then we fetch the diff and grab the output
    let commits = "";
    let myError = "";
    const options = {};
    options.listeners = {
      stdout: (data) => {
        commits = `${commits}${data.toString()}`;
      },
      stderr: (data) => {
        myError = `${myError}${data.toString()}`;
      },
    };

    // get diff between master and current branch
    await exec.exec(getCommits, [], options);

    // If there were errors, we throw it
    if (myError !== "") {
      throw new Error(myError);
    }

    await postToGit(URL, GITHUB_TOKEN, makeTemplate(commits, PR_URL));
    console.log("Changelog successfully posted");
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
})();
