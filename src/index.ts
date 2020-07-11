import fetch from 'node-fetch';
import exec from '@actions/exec';
import github from '@actions/github';
import core from '@actions/core';
import makeTemplate from './template';
import { gitNoTag, changeFiles, getCommits, gitPrume } from './commands';

const pull_request = github.context.payload.pull_request;
const PR_ID = pull_request.number;
const URL = pull_request.comments_url;
const GITHUB_TOKEN = core.getInput('token') || process.env.token;

const postToGit = async (url, key, body) => {
  const rawResponse = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `token ${key}`,
      'Content-Type': 'application/json',
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
      throw new Error('Missing auth thoken');
    }
    console.log('Generating changelog....');

    await exec.exec(gitPrume);
    await exec.exec(gitNoTag);

    // then we fetch the diff and grab the output
    let commits = {};
    let commitsStr = '';
    let myError = '';

    // get diff between master and current branch
    await exec.exec(getCommits(PR_ID), [], {
      listeners: {
        stdout: (data) => {
          const splitted = data.toString().split('\n');
          splitted.forEach((item) => {
            if (item === '') {
              return;
            }
            const sha = item.substr(0, 40);
            if (sha === '') {
              return;
            }
            const message = item.substr(41);
            commits[sha] = { message };
          });

          // remove
          commitsStr = `${commitsStr}${data.toString()}`;
        },
        stderr: (data) => {
          myError = `${myError}${data.toString()}`;
        },
      },
    });

    // If there were errors, we throw it
    if (myError !== '') {
      throw new Error(myError);
    }

    const shaKeys = Object.keys(commits).map(
      (sha) =>
        new Promise((resolve, reject) => {
          exec.exec(changeFiles(sha), [], {
            listeners: {
              stdout: (data) => {
                commits[sha].files = data
                  .toString()
                  .split('\n')
                  .filter((i) => i);
                resolve();
              },
              stderr: (data) => {
                myError = `${myError}${data.toString()}`;
              },
            },
          });
        }),
    );

    await Promise.all(shaKeys);

    await postToGit(URL, GITHUB_TOKEN, makeTemplate(commits));
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
})();
