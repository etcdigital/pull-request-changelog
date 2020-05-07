const fetch = require("node-fetch");
const exec = require("@actions/exec");
const github = require("@actions/github");
const core = require("@actions/core");

const URL = github.context.payload.pull_request.comments_url;
const GITHUB_TOKEN = core.getInput("token") || process.env.token;

const isBreakingChange = (change) => {
  const firstWord = change.split(" ")[0];
  return (
    change.includes(":boom:") ||
    change.includes("BREAKING CHANGE") ||
    change.includes("BREAKING_CHANGE") ||
    firstWord.includes("!")
  );
};

const isFeatChange = (change) => {
  const firstWord = change.split(" ")[0];
  return change.includes(":sparkles:") || firstWord.includes("feat");
};

const isFixesChange = (change) => {
  const firstWord = change.split(" ")[0];
  return change.includes(":bug:") || firstWord.includes("fix");
};

const isDevOpsChange = (change) => {
  const firstWord = change.split(" ")[0];
  return (
    change.includes(":white_check_mark") ||
    firstWord.includes("ci:") ||
    firstWord.includes("build:") ||
    firstWord.includes("test:")
  );
};

/***
 * @param {String} changelog: String of changes, where every line is an entry in changelog
 * Changelog from git comes in string format, where every line
 * represents a valid contribution to the project. This functions takes
 * string changelog and groups all changes based on the first word in change
 * Example:
 * Input:
 * :bug: Fixed async behavior
 * :bug: Fix flickering on mobile
 * :sparkles: Add call me button
 *
 * Output:
 * {
 *   ':bug:': [':bug: Fixed async behavior', ':bug: Fix flickering on mobile']
 *   ':sparkles:' : [':sparkles: Add call me button']
 * }
 */
const groupChangelog = (changelog) => {
  let grouping = {};
  // Split changelog on new lines
  changelog.forEach((change) => {
    // find the first word and group all changes by first word
    const key = change.substring(0, change.indexOf(" "));
    if (grouping[key] === undefined) {
      grouping[key] = [];
    }
    grouping[key].push(change);
  });
  return grouping;
};

/**
 *
 * @param {Object} changes
 * Function takes objects grouped by keys and coverts them to concatinated string grouped by key
 * Example:
 * Input:
 * {
 *   ':bug:': [':bug: Fixed async behavior', ':bug: Fix flickering on mobile']
 *   ':sparkles:' : [':sparkles: Add call me button']
 * }
 * Output
 * ':bug: Fixed async behavior'
 * ':bug: Fix flickering on mobile'
 *
 * ':sparkles: Add call me button'
 */
const changesToTemplate = (changes) => {
  let output = "";
  Object.keys(changes).forEach((key) => {
    changes[key].forEach((change) => {
      output = `${output}${change}
`;
    });
    output = `${output}`;
  });
  return output;
};

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
    await exec.exec(
      `git log --no-merges origin/pr/${github.context.payload.pull_request.number} ^origin/master --pretty='%s'`,
      [],
      options
    );
    // If there were errors, we throw it
    if (myError !== "") {
      throw new Error(myError);
    }
    // output is quoted, so we need to remove the quotes and split it by \n to get each change
    console.log({ myOutput });
    const changes = myOutput
      .split("\n")
      .map((c) => c.substring(1, c.length - 1));
    console.log({ changes });

    const breakChanges = {
      title: `### Breaking Changes

`,
      changes: changes.filter((change) => isBreakingChange(change)),
    };

    const featChanges = {
      title: `### Features

`,
      changes: changes.filter((change) => isFeatChange(change)),
    };

    const fixesChanges = {
      title: `### Features

`,
      changes: changes.filter((change) => isFixesChange(change)),
    };

    const devOpsChanges = {
      title: `### DevOps

`,
      changes: changes.filter((change) => !isDevOpsChange(change)),
    };

    const otherChanges = {
      title: `### Changes

`,
      changes: changes.filter(
        (change) => !isBreakingChange(change) && !isFeatChange(change)
      ),
    };

    let changesTemplate = "";
    [
      breakChanges,
      featChanges,
      fixesChanges,
      devOpsChanges,
      otherChanges,
    ].forEach((changeType) => {
      const groupedChanges = groupChangelog(changeType.changes);
      if (Object.keys(groupedChanges).length > 0) {
        changesTemplate = `
${changesTemplate}

${changeType.title}${changesToTemplate(groupedChanges)}
`;
      }
    });

    // we don't really need a result here...
    const content = await postToGit(URL, GITHUB_TOKEN, changesTemplate);
    console.log(content);
    console.log("Changelog successfully posted");
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
})();
