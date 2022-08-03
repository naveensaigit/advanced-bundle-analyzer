// Remove newlines, consecutive and trailing whitespace's
export function preprocess(str: string): string {
  return str.trim().replace(/\s\s+/g, " ").toString().replaceAll("\n", "");
}

// Remove comments present in file
export function removeComments(data: string): string {
  let regex = /\/\/.*|\/\*[^]*\*\//g;

  return data.replace(regex, "");
}