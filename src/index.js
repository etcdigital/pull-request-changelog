const fetch = require("node-fetch");
const exec = require("@actions/exec");
const github = require("@actions/github");
const core = require("@actions/core");

const URL = github.context.payload.pull_request.comments_url;
const GITHUB_TOKEN = core.getInput("token") || process.env.token;

/**
 *
 * @param {String} url: Url to post to (PR comments in git are treated as issues)
 * @param {String} key: Github token
 * @param {String} body: Text (HTML)
 * Output is API Response
 */
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

const prepareCommit = (str) => {
  const dotsIndex = str.split(" ")[0].indexOf(":");
  if (dotsIndex < 0) {
    return { prefix: "", message: str };
  }
  const prefix = str.substr(0, dotsIndex + 1);
  const message = str.substr(dotsIndex + 2);

  return { prefix, message };
};

const categories = {
  "feat:": "feat",
  "fix:": "fix",
  "ci:": "maintenance",
  "test:": "maintenance",
  "build:": "maintenance",
};

const otherCategory = "other";

const getCategory = (prefix) => {
  const category = prefix ? categories[prefix] : otherCategory;
  if (category) {
    return category;
  }
  return otherCategory;
};

/**
 * Action core
 */
(async () => {
  try {
    if (GITHUB_TOKEN === undefined) {
      throw new Error("Missing auth thoken");
    }
    console.log("Generating changelog....");
    // we'll use github cli to provide us with commit diff
    // first we need to fetch the needed branches
    await exec.exec(
      "git fetch --no-tags --prune origin +refs/pull/*/head:refs/remotes/origin/pr/*"
    );
    await exec.exec(
      "git fetch --no-tags origin +refs/heads/*:refs/remotes/origin/*"
    );

    const prNumber = github.context.payload.pull_request.number;

    // then we fetch the diff and grab the output
    let myOutput = "";
    let myError = "";
    const options = {};
    options.listeners = {
      stdout: (data) => {
        myOutput = `${myOutput}${data.toString()}`;
      },
      stderr: (data) => {
        myError = `${myError}${data.toString()}`;
      },
    };
    // get diff between master and current branch

    const getCommits = `git log --no-merges origin/pr/${prNumber} ^origin/master --pretty=oneline --no-abbrev-commit`;
    await exec.exec(getCommits, [], options);
    // If there were errors, we throw it
    if (myError !== "") {
      throw new Error(myError);
    }
    // output is quoted, so we need to remove the quotes and split it by \n to get each change
    console.log({ myOutput });

    let changes = [];

    myOutput.split("\n").forEach((line) => {
      const hash = line.substr(0, 40);
      const { prefix, message } = prepareCommit(line.substr(41));

      const hashLink = `[${hash.substr(
        0,
        7
      )}](https://github.com/etcdigital/pull-request-changelog/pull/${prNumber}/commits/${hash})`;
      const prefixBold = prefix ? `**${prefix}** ` : "";

      const category = getCategory(prefix);
      if (!changes[category]) {
        changes[category] = [];
      }
      changes[category].push(
        `(${hashLink}) ${
          category !== otherCategory ? prefixBold : ""
        }${message}`
      );
    });

    const changesTemplate = "```";
    const breakline = `
`;

    if (changes["feat"]) {
      changesTemplate += `### Features${breakline}`;
      changesTemplate += changes["feat"].join(breakline);
    }

    if (changes["fix"]) {
      changesTemplate += `### Fixes${breakline}`;
      changesTemplate += changes["fix"].join(breakline);
    }

    if (changes["maintenance"]) {
      changesTemplate += `### Maintenance${breakline}`;
      changesTemplate += changes["maintenance"].join(breakline);
    }

    if (changes[otherCategory]) {
      changesTemplate += `### Changes${breakline}`;
      changesTemplate += changes[otherCategory].join(breakline);
    }

    changesTemplate += `\`\`\``;

    // we don't really need a result here...
    const content = await postToGit(URL, GITHUB_TOKEN, changesTemplate);
    console.log("Changelog successfully posted");
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
})();
