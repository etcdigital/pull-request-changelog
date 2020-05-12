const fetch = require("node-fetch");
const exec = require("@actions/exec");
const github = require("@actions/github");
const core = require("@actions/core");

const pull_request = github.context.payload.pull_request;
const PR_ID = pull_request.number;
const URL = pull_request.comments_url;
const GITHUB_TOKEN = core.getInput("token") || process.env.token;

console.log(github.context.payload);
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

const changesHeader = "changes";

const headers = {
  "feat:": "feat",
  "fix:": "fix",
};

const getHeader = (prefix) => {
  const header = prefix ? headers[prefix] : changesHeader;
  if (header) {
    return header;
  }
  return changesHeader;
};

const commitUrl = (hash) =>
  `https://github.com/etcdigital/pull-request-changelog/pull/${PR_ID}/commits/${hash}`;

let changes = [];

const prepareOutput = (line) => {
  const hash = line.substr(0, 40);
  const { prefix, message } = prepareCommit(line.substr(41));

  if (!prefix && !message) {
    return;
  }

  const hashLink = `([${hash.substr(0, 7)}](${commitUrl(hash)}))`;
  const prefixBold = prefix ? `**${prefix}** ` : "";

  const h = getHeader(prefix);
  if (!changes[h]) {
    changes[h] = [];
  }

  const showPrefix = h === changesHeader ? prefixBold : "";
  changes[h].push(`- ${showPrefix}${message} ${hashLink}`);
};

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

    await exec.exec(
      "git fetch --no-tags --prune origin +refs/pull/*/head:refs/remotes/origin/pr/*"
    );
    await exec.exec(
      "git fetch --no-tags origin +refs/heads/*:refs/remotes/origin/*"
    );

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
    await exec.exec(getCommits, [], options);

    // If there were errors, we throw it
    if (myError !== "") {
      throw new Error(myError);
    }

    myOutput.split("\n").forEach(prepareOutput);

    const breakline = `
`;
    let changesTemplate = "";

    if (changes["feat"]) {
      changesTemplate += `
## ✨ Features${breakline}`;
      changesTemplate += changes["feat"].join(breakline);
    }

    if (changes["fix"]) {
      changesTemplate += `
## 🐞 Fixes${breakline}`;
      changesTemplate += changes["fix"].join(breakline);
    }

    if (changes[changesHeader]) {
      changesTemplate += `
## 📋 Changes${breakline}`;
      changesTemplate += changes[changesHeader].join(breakline);
    }

    await postToGit(URL, GITHUB_TOKEN, changesTemplate);
    console.log("Changelog successfully posted");
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
})();
