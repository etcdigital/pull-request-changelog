let PR_URL = "";
const breakline = `
`;

let changes = [];

const changesHeader = "changes";

const headers = {
  "feat:": "feat",
  "fix:": "fix",
  "docs:": "docs",
  "ci:": "ci",
  "test:": "test",
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
  if (parentesesStartIndex > -1) {
    const parentesesEndIndex = prefix.indexOf(")");
    if (parentesesEndIndex > -1) {
      let prefixStart = prefix.split("(");
      if (prefixStart[1]) {
        let scopeSplited = prefixStart[1].split(")")[0];
        if (scopeSplited) {
          scope = scopeSplited;
        }
      }
      prefix = `${prefixStart[0]}:`;
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

const showList = (topic) => {
  const items = changes[topic];
  const scopes = { "no-scope": [] };
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
      return `### - ${key}${breakline}${joiner}`;
    }
  });
  return toReturn.join(breakline);
};

module.exports = function MakeTemplate(commits, pullRequestUrl = "") {
  PR_URL = pullRequestUrl;
  commits.split("\n").forEach(prepareOutput);

  let changesTemplate = "";

  const doubleBreakline = () => {
    if (changesTemplate) {
      changesTemplate += breakline;
      changesTemplate += breakline;
    }
  };

  const separator = () => {
    if (changesTemplate) {
      changesTemplate += `${breakline}---${breakline}`;
    }
  };

  if (changes["feat"]) {
    separator();
    doubleBreakline();
    changesTemplate += `## ✨ Features${breakline}`;
    changesTemplate += showList("feat");
  }

  if (changes["fix"]) {
    separator();
    doubleBreakline();
    changesTemplate += `## 🐞 Fixes${breakline}`;
    changesTemplate += showList("fix");
  }

  if (changes["ci"]) {
    separator();
    doubleBreakline();
    changesTemplate += `## 🏗 CI${breakline}`;
    changesTemplate += showList("fix");
  }

  if (changes["test"]) {
    separator();
    doubleBreakline();
    changesTemplate += `## 🏗 Test${breakline}`;
    changesTemplate += showList("fix");
  }

  if (changes[changesHeader]) {
    separator();
    doubleBreakline();
    changesTemplate += `## 📋 Changes${breakline}`;
    changesTemplate += showList(changesHeader);
  }

  return changesTemplate;
};
