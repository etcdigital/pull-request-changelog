import { IChangesContent } from './common';

const breakline = `
`;

export const getMarkdownOfHead = (
  title: string,
  items: IChangesContent[],
): string => {
  const scopes = { 'no-scope': [] };
  items.forEach(({ scope, message }) => {
    if (!scopes[scope]) {
      scopes[scope] = [];
    }
    scopes[scope].push(message);
  });
  const toReturn = Object.keys(scopes).map((key) => {
    const joiner = scopes[key].join(breakline);
    if (key === 'no-scope') {
      return `${breakline}${joiner}`;
    } else {
      return `### - ${key}${breakline}${joiner}`;
    }
  });
  return `${title}${breakline}${toReturn.join(breakline)}`;
};
