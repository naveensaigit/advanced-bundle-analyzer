import fs from "fs";
import { preprocess, removeComments } from "./utils.js";

// Type for lazy import object
type lazyImp = {
  import: string;
  lazyImp: string;
  module: string
};

// Return type for getLazy
type getLazy = {
  newcode: string;
  lazyImps: lazyImp[]
};

type RegEx = RegExpExecArray | null;

// Function to get lazy imports and then remove them from code
function getLazyImports(code: string): getLazy {
  // Lazy import is of the form -
  // keyword varName = lazyFunc(() => import("module"))
  // where keyword can be var, let, const or , (multiple declarations in same line)
  // varName is a valid JavaScript variable containing alphanumeric, $ and _ chars

  const reg: RegExp = new RegExp(
    // eslint-disable-next-line no-control-regex
    "(var|let|const|,)(\\s|\r\n)+(([a-zA-Z]|$|_)([a-zA-Z]|$|_|[0-9])*)(\\s|\r\n)*=\\s*(.|\r\n)*?\\s*import\\s*(.|\r\n)*?\\s*\\(((.|\r\n|\\s)*?)\\)",
    "gm"
  );

  const lazyImps: lazyImp[] = [];
  let match: RegEx, newcode: string = code;

  do {
    // Find each import
    match = reg.exec(code);
    if (match) {
      // Convert the import statement into an object
      const importLine: string = match[0],
        lazyImp: string = match[3],
        module: string = match[9].slice(1, -1);
      // Remove this existing dynamic imports from the code
      newcode = newcode.replace(importLine, "");
      // Add the dynamic import
      lazyImps.push({
        import: importLine,
        lazyImp,
        module,
      });
    }
  } while (match);

  // Return the new code and list of lazy imports
  return { newcode, lazyImps };
}

// Remove single file imports
function removeImports(text: string): string {
  // Remove file import - import "filename";
  const reg: RegExp = /import((\r\n|\s)*?)?('|")(.*)('|");/gm;
  // Replace these imports with empty string
  return text.replace(reg, "");
}

type stringToNamedImp = {
  namedImp: string;
  alias?: string;
};

// Convert "NamedImp as Alias" => {namedImp, alias}
function stringToNamedImps(imp: string): stringToNamedImp {
  // Trim the string and replace multiple spaces with single space
  const impArray: string[] = preprocess(imp).split(" ");
  return impArray.length === 1
    ? { namedImp: impArray[0] }
    : { namedImp: impArray[0], alias: impArray[2] };
}

// Get named imports section from an import statement
function getNamedImps(stmt: string): stringToNamedImp[] | null {
  // Named imports section is enclosed within { ... }
  // eslint-disable-next-line no-control-regex
  const namedImpsExp: RegExp = new RegExp("{((.|\r\n|\\s)*?)}", "gm");
  const namedImps: RegEx = namedImpsExp.exec(stmt);

  if (namedImps) {
    // Taking the second element to get the second group from
    // regex which contains the contents inside { ... }

    // Split string by , to get each import individually
    const namedImpsString: string[] = namedImps[1].split(",");
    // Convert the string into an object
    const newNamedImps: stringToNamedImp[] = namedImpsString.map(stringToNamedImps);
    return newNamedImps;
  }

  return null;
}

// Get default import from an import statement
function getDefaultImp(stmt: string): string | null {
  // Default import is preceded by either "import" or ","
  // and succeeded by either "," or "from"
  const defaultImpRegEx: RegExp = new RegExp(
    // eslint-disable-next-line no-control-regex
    "(import|,)((\r\n|\\s)*?)?(\\w*)((\r\n|\\s)*?)?(,|from)",
    "gm"
  );

  const defaultImp: RegEx = defaultImpRegEx.exec(stmt);

  if (defaultImp) {
    // Taking the fourth element to get the fourth group
    // from regex which contains the default import

    // Remove trailing whitespaces and newlines
    const defaultImpStr: string = preprocess(defaultImp[4]);
    return defaultImpStr;
  }

  return null;
}

// Get namespace import from an import statement
function getNamespaceImp(stmt: string): string | null {
  // Namespace import contains "* as". It can
  // be succeeded by either a "," or "from"
  const namespaceImpRegEx: RegExp = new RegExp(
    // eslint-disable-next-line no-control-regex
    "\\*((.|\r\n|\\s)*?)?as((.|\r\n|\\s)*?)?((.|\r\n|\\s)*?)(,|from)",
    "gm"
  );

  const namespaceImp: RegEx = namespaceImpRegEx.exec(stmt);

  if (namespaceImp) {
    // Taking the fifth element to get the fifth group
    // from regex which contains the namespace import

    // Remove trailing whitespaces and newlines
    const namespaceImpStr: string = preprocess(namespaceImp[5].toString());
    return namespaceImpStr;
  }

  return null;
}

type imports = {
  import: string;
  defaultImp: string | null;
  namedImps: stringToNamedImp[] | null;
  namespaceImp: string | null;
  module: string;
} | null;

// Convert import statement to an object
function importToObj(imp: RegExpExecArray): imports {
  if (!imp) return null;

  const module = imp[3].match(/('|")(.*)('|")/gm);
  const moduleStr: string | undefined = module?.[0];

  if (!moduleStr) return null;

  const stmt: string = imp[0];

  const namedImps: stringToNamedImp[] | null = getNamedImps(stmt);

  const defaultImp: string | null = getDefaultImp(stmt);

  const namespaceImp: string | null = getNamespaceImp(stmt);

  return {
    import: stmt, // Import statement
    defaultImp, // Default import present in the import statement
    namedImps: namedImps, // Named imports present in the import statement
    namespaceImp, // Namespace import present in the import statement
    module: moduleStr.slice(1, -1), // Name of module from which import is happening
  };
}

type returnGetImports = {
  imports: imports[];
  lazyImps: lazyImp[];
}

// Get an array of import objects for each import statement in the code
export function getImports(filePath: string): returnGetImports {
  // Read the file contents
  const origCode: string = fs.readFileSync(filePath, "utf8");
  // Get Lazy loaded imports and remove them from code
  const { newcode: codeWithoutLazy, lazyImps }: getLazy = getLazyImports(origCode);
  // Declaring variables to store ordinary imports and regex matches
  const imports: imports[] = [];
  let match: RegEx;

  // Remove comments from the code
  const codeWithoutComments = removeComments(codeWithoutLazy);
  // Remove single file imports
  const code = removeImports(codeWithoutComments);

  // Import statements are of the form "import <imports> from <moduleName>;"
  // eslint-disable-next-line no-control-regex
  const reg: RegExp = new RegExp("import((.|\r\n|\\s)*?)?from((.|\r\n|\\s)*?)?;", "gm");

  do {
    // Find each import
    match = reg.exec(code);
    if (match) {
      // Convert the import statement into an object
      const importObj: imports = importToObj(match);
      imports.push(importObj);
    }
  } while (match);

  return { imports, lazyImps };
}
