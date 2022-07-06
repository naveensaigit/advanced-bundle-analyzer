// Remove newlines, consecutive and trailing whitespaces
export function preprocess(str: string): string {
  return str.trim().replace(/\s\s+/g, " ").replaceAll("\n", "");
}

// Remove comments present in file
export function removeComments(data: string): string {
  const regex: RegExp = /\/\/.*|\/\*[^]*\*\//g;
  return data.replace(regex, "");
}