import { changesHeader } from './headers';

const getScope = (prefix: string): { heading: string; prefix: string } => {
  let heading = '';
  if (!prefix) {
    return { heading, prefix: changesHeader };
  }
  const parentesesStartIndex = prefix.indexOf('(');
  if (parentesesStartIndex > -1) {
    const parentesesEndIndex = prefix.indexOf(')');
    if (parentesesEndIndex > -1) {
      let prefixStart = prefix.split('(');
      if (prefixStart[1]) {
        let scopeSplited = prefixStart[1].split(')')[0];
        if (scopeSplited) {
          heading = scopeSplited;
        }
      }
      prefix = `${prefixStart[0]}:`;
    }
  }
  return { heading, prefix };
};

export const getMessageDetails = (
  str,
): { prefix: string; message: string; heading: string } => {
  const dotsIndex = str.split(' ')[0].indexOf(':');
  if (dotsIndex < 0) {
    return { prefix: '', message: str, heading: '' };
  }
  const { prefix, heading } = getScope(str.substr(0, dotsIndex + 1));
  const message = str.substr(dotsIndex + 1).trim();

  return { prefix, message, heading };
};
