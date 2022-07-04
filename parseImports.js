// Parsing import statements in a file

// Remove comments present in file
export function removeComments(data) {
  // Regex to find single line comments - Starts with //
  let regex = /\/\/.*/g;
  // Replace these comments with empty string
  data = data.replace(regex, "");

  // Regex to find multi-line comments
  // Starts with /* and ends with */
  regex = /\/\*(\s|.|\r\n)*?\*\//gm;
  // Replace these comments with empty string
  data = data.replace(regex, "");

  return data;
}

// Remove single file imports and existing dynamic imports
export function removeImports(text) {
  // Remove imports of the type -
  // 1. File import - import "filename";
  // 2. Dynamic import - import("filename")
  let reg = /import((\r\n|\s|\()*?)?('|")(.*)('|")(\))*;/gm;
  // Replace these imports with empty string
  return text.replace(reg, "");
}

export function stringToNamedExps(imp) {
  // Trim the string and replace multiple spaces with single space
  imp = imp.trim().replace(/\s\s+/g, ' ').split(" ");
  return imp.length == 1 ? {namedExp: imp[0]} : {namedExp: imp[0], alias: imp[2]};
}

// Get named exports section from an import statement
export function getNamedExps(stmt) {
  // Named exports section is enclosed within { ... }
  let namedExps = new RegExp("{((.|\r\n|\\s)*?)}", "gm");
  namedExps = namedExps.exec(stmt);

  if (namedExps) {
    // Taking the second element to get the second group from
    // regex which contains the contents inside { ... }

    // Split string by , to get each export individually
    namedExps = namedExps[1].split(",");
    // Convert the string into an object
    namedExps = namedExps.map(stringToNamedExps);
  }

  return namedExps;
}

// Get default export from an import statement
export function getDefaultExp(stmt) {
  // Default export is preceded by either "import" or ","
  // and succeeded by either "," or "from"
  let defaultExp = new RegExp("(import|,)((\r\n|\\s)*?)?(\\w*)((\r\n|\\s)*?)?(,|from)", "gm");
  defaultExp = defaultExp.exec(stmt);

  if (defaultExp)
    // Taking the fourth element to get the fourth group
    // from regex which contains the default export

    // Remove trailing whitespaces and remove newlines
    defaultExp = defaultExp[4].trim().replaceAll("\n", "");

  return defaultExp;
}

// Get namespace export from an import statement
export function getNamespaceExp(stmt) {
  // Namespace export contains "* as". It can
  // be succeeded by either a "," or "from"
  let namespaceExp = new RegExp("\\*((.|\r\n|\\s)*?)?as((.|\r\n|\\s)*?)?((.|\r\n|\\s)*?)(,|from)", "gm");
  namespaceExp = namespaceExp.exec(stmt);

  if (namespaceExp)
    // Taking the fifth element to get the fifth group
    // from regex which contains the namespace export

    // Remove trailing whitespaces and remove newlines
    namespaceExp = namespaceExp[5].trim().replaceAll("\n", "");

  return namespaceExp;
}

// Convert import statement to an object
export function importToObj(imp) {
  let module = imp[3].match(/('|")(.*)('|")/gm)[0];
  let stmt = imp[0];

  let namedExps = getNamedExps(stmt);

  let defaultExp = getDefaultExp(stmt);

  let namespaceExp = getNamespaceExp(stmt);

  return {
    import: stmt,         // Import statement
    defaultExp,           // Default export present in the import statement
    namedExps: namedExps, // Named exports present in the import statement
    namespaceExp,         // Namespace export present in the import statement
    module                // Name of module from which import is happening
  };
}

// Get an array of import objects for each import statement in the code
export function getImports(code) {
  let imports = [], match;
  // Remove comments from the code
  //code = removeComments(code);
  // Remove single file imports and existing dynamic imports
  code = removeImports(code);

  // Import statements are of the form "import <imports> from <moduleName>;"
  let reg = new RegExp("import((.|\r\n|\\s)*?)?from((.|\r\n|\\s)*?)?;", "gm");

  do {
    // Find each import
    match = reg.exec(code);
    if (match) {
      // Convert the import statement into an object
      let importObj = importToObj(match);
      imports.push(importObj);
    }
  } while (match);

  return imports;
}