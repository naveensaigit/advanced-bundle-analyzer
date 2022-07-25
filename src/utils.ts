// Remove newlines, consecutive and trailing whitespaces
export function preprocess(str: string): string {
  return str.trim().replace(/\s\s+/g, " ").toString().replaceAll("\n", "");
}

// Remove comments present in file
export function removeComments(data: string): string {
  let regex: RegExp = /([^:]\/\/.*|\/\*((.|\r\n|\s)*?)\*\/)/gm;

  return data.replace(regex, "");
}