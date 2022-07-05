// Remove newlines, consecutive and trailing whitespaces
export function preprocess(str) {
  return str.trim().replace(/\s\s+/g, " ").toString().replaceAll("\n", "");
}
// Remove comments present in file
export function removeComments(data) {
  let regex = /\/\/.*|\/\*[^]*\*\//g;
  return data.replace(regex, "");
}
