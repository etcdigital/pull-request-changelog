const fetch = require("node-fetch");
const exec = require("@actions/exec");
const github = require("@actions/github");
const core = require("@actions/core");

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

const breakline = `
`;

const changesHeader = "changes";

const headers = {
  "feat:": "feat",
  "fix:": "fix",
  "docs:": "docs",
};

const prepareCommit = (str) => {
  const dotsIndex = str.split(" ")[0].indexOf(":");
  if (dotsIndex < 0) {
    return { prefix: "", message: str };
  }
  const { prefix, scope } = getScope(str.substr(0, dotsIndex + 1));
  const message = str.substr(dotsIndex + 2);

  return { prefix, message, scope };
};

const getScope = (prefix) => {
  let scope = "";
  if (!prefix) {
    return { scope, prefix: changesHeader };
  }
  const parentesesStartIndex = prefix.indexOf("(");
  if (parentesesStartIndex < 0) {
    const parentesesEndIndex = prefix.indexOf(")");
    if (parentesesEndIndex < 0) {
      let prefixStart = prefix.split("(");
      console.log({ prefixStart });
      if (prefixStart[1]) {
        let scopeSplited = prefixStart[1](")")[0];
        console.log({ scopeSplited });
        if (scopeSplited) {
          scope = scopeSplited;
        }
      }
      prefix = prefixStart;
    }
  }
  return { scope, prefix };
};

const getHeader = (prefix) => {
  const header = headers[prefix] || changesHeader;
  if (header) {
    return header;
  }
  return changesHeader;
};

const commitUrl = (hash) => `${PR_URL}/commits/${hash}`;

let changes = [];

const prepareOutput = (line) => {
  // Get Hash, prefix and message
  const hash = line.substr(0, 40);
  const { prefix, scope, message } = prepareCommit(line.substr(41));

  // Check if commit has a valid message
  if (!prefix && !message) {
    return;
  }

  // Create a hash link
  const hashLink = `([${hash.substr(0, 7)}](${commitUrl(hash)}))`;

  // Prepare
  const h = getHeader(prefix);
  if (!changes[h]) {
    changes[h] = [];
  }

  const prefixBold = prefix ? `**${prefix}** ` : "";

  const showPrefix = h === changesHeader ? prefixBold : "";
  changes[h].push({
    scope: scope || "no-scope",
    message: `- ${showPrefix}${message} ${hashLink}`,
  });
};

const prepareToShow = (items) => {
  const scopes = {};
  items.forEach(({ scope, message }) => {
    if (!scopes[scope]) {
      scopes[scope] = [];
    }
    scopes[scope].push(message);
  });
  const toReturn = Object.keys(scopes).map((key) => {
    const joiner = scopes[key].join(breakline);
    if (key === "no-scope") {
      return `${breakline}${joiner}`;
    } else {
      return `${breakline}##### ${key}${breakline}${joiner}`;
    }
  });
  console.log(JSON.stringify(toReturn, null, 2), "-------end prepare");
  return toReturn;
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

    let changesTemplate = "";

    if (changes["feat"]) {
      changesTemplate += `
## ✨ Features${breakline}`;
      changesTemplate += prepareToShow(changes["feat"]).join(breakline);
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
