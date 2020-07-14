// Header(aka heading): H1, H2, H3 and H4 but in markdown
// Scope: Main group separations after Headers
import { IChanges } from './common';
import { changesHeader, getHeader } from './headers';
import { getMessageDetails } from './message';
import { getMarkdownOfHead } from './markdown';

const breakline = `
`;

let changes: IChanges[] = [];

//
//
//
//

const prepareOutput = (sha, contentObject) => {
  const { prefix, heading, message } = getMessageDetails(contentObject.message);

  // Check if commit has a valid message
  if (!prefix && !message) {
    return;
  }

  // Prepare
  const h = getHeader(prefix);
  if (!changes[h]) {
    changes[h] = [];
  }

  const showPrefix = h === changesHeader ? prefix : '';
  changes[h].push({
    scope: heading || 'no-scope',
    message: `<details>
    <summary>${sha.substr(0, 7)} - ${showPrefix}${message}</summary>
    ${breakline}#### Changed files${breakline}${contentObject.files
      .map((file) => `- ${file}`)
      .join('\n')}
  </details>`,
  });
};

export default function MakeTemplate(commits): string {
  Object.keys(commits).forEach((sha) => prepareOutput(sha, commits[sha]));

  let changesTemplate: string[] = [];

  const featLogs = changes['feat'];
  if (featLogs) {
    changesTemplate.push(getMarkdownOfHead('## ✨ Features', featLogs));
  }

  const fixLogs = changes['fix'];
  if (fixLogs) {
    changesTemplate.push(getMarkdownOfHead('## 🐞 Fixes', fixLogs));
  }

  const refactorLogs = changes['refactor'];
  if (refactorLogs) {
    changesTemplate.push(getMarkdownOfHead('## ♻️ Refactors', refactorLogs));
  }

  let testLogs = changes['test'];
  if (testLogs) {
    changesTemplate.push(getMarkdownOfHead('## 🧪 Tests', testLogs));
  }

  const ciLogs = changes['ci'];
  if (ciLogs) {
    changesTemplate.push(getMarkdownOfHead('## 🏗 CI', ciLogs));
  }

  const changesLogs = changes[changesHeader];
  if (changesLogs) {
    changesTemplate.push(getMarkdownOfHead('## 📋 Changes', changesLogs));
  }

  return changesTemplate.join(`${breakline}${breakline}`);
}
