import fs from "fs";
import { preprocess, removeComments } from "./utils.js";

// Function to get lazy imports and then remove them from code
function getLazyImports(code) {
  // Lazy import is of the form -
  //    keyword varName = lazyFunc(() => import("module"))
  // where keyword can be var, let, const or , (multiple declarations in same line)
  // varName is a valid JavaScript variable containing alphanumeric, $ and _ chars
  let reg = new RegExp(
    "(var|let|const|,)(\\s|\r\n)+(([a-zA-Z]|$|_)([a-zA-Z]|$|_|[0-9])*)(\\s|\r\n)*=\\s*(.|\r\n)*?\\s*import\\s*(.|\r\n)*?\\s*\\(((.|\r\n|\\s)*?)\\)",
    "gm"
  );

  let lazyImps = [], match, newcode = code;

  do {
    // Find each import
    match = reg.exec(code);
    if (match) {
      // Convert the import statement into an object
      let importLine = match[0], lazyImp = match[3], module = match[9].slice(1, -1);
      // Remove this existing dynamic imports from the code
      newcode = newcode.replace(importLine, "");
      // Add the dynamic import
      lazyImps.push({
        import: importLine,
        lazyImp,
        module
      });

    }
  } while (match);

  // Return the new code and list of lazy imports
  return {newcode, lazyImps};
}

// Remove single file imports
function removeImports(text) {
  // Remove file import - import "filename";
  let reg = /import((\r\n|\s)*?)?('|")(.*)('|");/gm;
  // Replace these imports with empty string
  return text.replace(reg, "");
}

// Convert "NamedImp as Alias" => {namedImp, alias}
function stringToNamedImps(imp) {
  // Trim the string and replace multiple spaces with single space
  imp = preprocess(imp).split(" ");
  return imp.length === 1
    ? { namedImp: imp[0] }
    : { namedImp: imp[0], alias: imp[2] };
}

// Get named imports section from an import statement
function getNamedImps(stmt) {
  // Named imports section is enclosed within { ... }
  let namedImps = new RegExp("{((.|\r\n|\\s)*?)}", "gm");
  namedImps = namedImps.exec(stmt);

  if (namedImps) {
    // Taking the second element to get the second group from
    // regex which contains the contents inside { ... }

    // Split string by , to get each import individually
    namedImps = namedImps[1].split(",");
    // Convert the string into an object
    namedImps = namedImps.map(stringToNamedImps);
  }

  return namedImps;
}

// Get default import from an import statement
function getDefaultImp(stmt) {
  // Default import is preceded by either "import" or ","
  // and succeeded by either "," or "from"
  let defaultImp = new RegExp(
    "(import|,)((\r\n|\\s)*?)?(\\w*)((\r\n|\\s)*?)?(,|from)",
    "gm"
  );
  defaultImp = defaultImp.exec(stmt);

  if (defaultImp)
    // Taking the fourth element to get the fourth group
    // from regex which contains the default import

    // Remove trailing whitespaces and newlines
    defaultImp = preprocess(defaultImp[4]);

  return defaultImp;
}

// Get namespace import from an import statement
function getNamespaceImp(stmt) {
  // Namespace import contains "* as". It can
  // be succeeded by either a "," or "from"
  let namespaceImp = new RegExp(
    "\\*((.|\r\n|\\s)*?)?as((.|\r\n|\\s)*?)?((.|\r\n|\\s)*?)(,|from)",
    "gm"
  );
  namespaceImp = namespaceImp.exec(stmt);

  if (namespaceImp)
    // Taking the fifth element to get the fifth group
    // from regex which contains the namespace import

    // Remove trailing whitespaces and newlines
    namespaceImp = preprocess(namespaceImp[5]);

  return namespaceImp;
}

// Convert import statement to an object
function importToObj(imp) {
  let module = imp[3].match(/('|")(.*)('|")/gm)[0].slice(1, -1);
  let stmt = imp[0];

  let namedImps = getNamedImps(stmt);

  let defaultImp = getDefaultImp(stmt);

  let namespaceImp = getNamespaceImp(stmt);

  return {
    import: stmt, // Import statement
    defaultImp, // Default import present in the import statement
    namedImps: namedImps, // Named imports present in the import statement
    namespaceImp, // Namespace import present in the import statement
    module, // Name of module from which import is happening
  };
}

// Get an array of import objects for each import statement in the code
export function getImports(filePath) {
  // Read the file contents
  const oldcode = fs.readFileSync(filePath, "utf8");
  // Get Lazy loaded imports and remove them from code
  let {newcode: code, lazyImps} = getLazyImports(oldcode);
  // Declaring variables to store ordinary imports and regex matches
  let imports = [], match;

  // Remove comments from the code
  code = removeComments(code);
  // Remove single file imports
  code = removeImports(code, imports);

  // Import statements are of the form "import <imports> from <moduleName>;"
  let reg = new RegExp(
    "import((.|\r\n|\\s)*?)?from((.|\r\n|\\s)*?)?;",
    "gm"
  );

  do {
    // Find each import
    match = reg.exec(code);
    if (match) {
      // Convert the import statement into an object
      let importObj = importToObj(match);
      imports.push(importObj);
    }
  } while (match);

  return {imports, lazyImps};
}
