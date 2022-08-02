import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { preprocess, removeComments } from "./utils.js";
import { getJsxFunctions } from "./jsxFunctions.js";

// Path of this file
const __filename = fileURLToPath(import.meta.url);
// Path of the directory containing this file
// __dirname isn't defined for modules
const __dirname = path.dirname(__filename);

type lazyImp = { import: string; lazyImp: string; module: string };
type getLazy = { newcode: string; lazyImps: lazyImp[] };
type RegEx = RegExpExecArray | null;

type jsxFunctions = {
  [key: string]: boolean
};

export type jsxReturningFunctions = {
  [key: string]: jsxFunctions
}

export type defaultExpMemo = {
  [key: string]: string | null
}

let defaultExportsMemo: defaultExpMemo = {};
let jsxReturnTypeFunctions: jsxReturningFunctions = {};

// Function to get lazy imports and then remove them from code
function getLazyImports(code: string): getLazy {
  // Lazy import is of the form -
  // keyword varName = lazyFunc(() => import("module"))
  // where keyword can be var, let, const or , (multiple declarations in same line)
  // varName is a valid JavaScript variable containing alphanumeric, $ and _ chars

  let reg: RegExp = new RegExp(
    // eslint-disable-next-line no-control-regex
    "(var|let|const|,)(\\s|\r\n)+(([a-zA-Z]|$|_)([a-zA-Z]|$|_|[0-9])*)(\\s|\r\n)*=\\s*(.|\r\n)*?\\s*import\\s*(.|\r\n)*?\\s*\\(((.|\r\n|\\s)*?)\\)",
    "gm"
  );

  let lazyImps: lazyImp[] = [],
    match: RegEx,
    newcode: string = code;

  do {
    // Find each import
    match = reg.exec(code);
    if (match) {
      // Convert the import statement into an object
      let importLine: string = match[0],
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

  // Regex to remove anonymous dynamic imports
  reg = new RegExp("import(\\s|\r\n)*?\\(", "gm");

  do {
    match = reg.exec(code);
    if (match) {
      // Convert the import statement into an object
      let importLine: string = match[0];
      // Remove this existing dynamic imports from the code
      newcode = newcode.replace(importLine, "");
    }
  } while (match);

  // Return the new code and list of lazy imports
  return { newcode, lazyImps };
}

// Remove single file imports
function removeImports(text: string): string {
  // Remove file import - import "filename";
  let reg: RegExp = /import((\r\n|\s)*?)?('|")(.*)('|");/gm;
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
  let impArray: string[] = preprocess(imp).split(" ");
  return impArray.length === 1
    ? { namedImp: impArray[0] }
    : { namedImp: impArray[0], alias: impArray[2] };
}

// Get named imports section from an import statement
function getNamedImps(stmt: string): stringToNamedImp[] | null {
  // Named imports section is enclosed within { ... }
  // eslint-disable-next-line no-control-regex
  let namedImpsExp: RegExp = new RegExp("{((.|\r\n|\\s)*?)}", "gm");
  let namedImps: RegEx = namedImpsExp.exec(stmt);

  if (namedImps) {
    // Taking the second element to get the second group from
    // regex which contains the contents inside { ... }

    // Split string by , to get each import individually
    let namedImpsString: string[] = namedImps[1].split(",");
    // Convert the string into an object
    let newNamedImps: stringToNamedImp[] = namedImpsString.map(stringToNamedImps);
    return newNamedImps;
  }

  return null;
}

// Get default import from an import statement
function getDefaultImp(stmt: string): string | null {
  // Default import is preceded by either "import" or ","
  // and succeeded by either "," or "from"
  let defaultImpRegEx: RegExp = new RegExp(
    // eslint-disable-next-line no-control-regex
    "(import|,)((\r\n|\\s)*?)?(\\w*)((\r\n|\\s)*?)?(,|from)",
    "gm"
  );

  let defaultImp: RegEx = defaultImpRegEx.exec(stmt);

  if (defaultImp) {
    // Taking the fourth element to get the fourth group
    // from regex which contains the default import

    // Remove trailing whitespaces and newlines
    if(defaultImp[1] === "," && defaultImp[7] === ",")
      return null;
    let defaultImpStr: string = preprocess(defaultImp[4]);
    return defaultImpStr;
  }

  return null;
}

// Get name of default export from a file
function getDefaultExp(filePath: string): string | null {
  // If default export is already stored in memo, return it
  if (typeof defaultExportsMemo[filePath] !== "undefined")
    return defaultExportsMemo[filePath];

  // Read the file contents
  const oldcode: string = fs.readFileSync(filePath, "utf8");
  let match: RegEx;

  // Remove comments from the code
  const code = removeComments(oldcode);

  // Match "export default function name()"
  const expDefFunc: RegExp = new RegExp(
    "export((\r\n|\\s)*?)?default((\r\n|\\s)*?)?function((\r\n|\\s)*?)?((\r\n|\\s|.)*?)\\(",
    "gm"
  );

  match = expDefFunc.exec(code);
  if (match && match[7])
    // Store default export in memo and return it
    return defaultExportsMemo[filePath] = preprocess(match[7]);

  // Match "export default expression"
  const expDef: RegExp = new RegExp(
    "export((\r\n|\\s)*?)?default((\r\n|\\s)*?)?((\r\n|\\s)*)?([^\n;]*)",
    "gm"
  );

  match = expDef.exec(code);
  if (match && match[7])
    // Store default export in memo and return it
    return defaultExportsMemo[filePath] = preprocess(match[7]);

  // Match "export { name as default }"
  const nameDef: RegExp = new RegExp(
    "export((\r\n|\\s)*?)?{((\r\n|\\s|.)*)}",
    "gm"
  );

  match = nameDef.exec(code);
  if (!(match && match[3]))
    // Store default export in memo and return it
    return defaultExportsMemo[filePath] = "";

  const namedExps: string[] = preprocess(match[3]).split(",");
  for (let namedExp of namedExps) {
    const [name, exportedAs] = namedExp.split("as");
    if (exportedAs.trim() === "default")
      // Store default export in memo and return it
      return defaultExportsMemo[filePath] = name.trim();
  }

  // No default exports present in this file
  return defaultExportsMemo[filePath] = null;
}

type defaultImport = {
  importedAs: string | null,
  exportedAs: string | null
}

type imports = {
  import: string;
  defaultImp: defaultImport | null;
  namedImps: stringToNamedImp[] | null;
  namespaceImp: string | null;
  module: string;
} | null;

// Convert import statement to an object
function importToObj(imp: RegExpExecArray, filePath: string, filterSuggestions: boolean): imports {
  if (!imp) return null;

  // Get path present in the import statement 
  let module = imp[3].match(/('|")(.*)('|")/gm);
  let moduleStr: string | undefined = module?.[0];

  if (!moduleStr) return null;
  // Remove the quotes from the import path
  moduleStr = moduleStr.slice(1, -1);

  let stmt: string = imp[0];

  // Get all named imports present in the import statement
  let namedImps: stringToNamedImp[] | null = getNamedImps(stmt);

  // Get default imports present in the import statement
  let importedAs: string | null = getDefaultImp(stmt);
  let exportPath = path.resolve(path.dirname(filePath), moduleStr);
  let exportedAs: string | null = null;

  // checking export path does not lie in node_modules
  let extensions: string[] = ['', '.js', '.jsx', '.ts', '.tsx'];
  let inNodeModule: boolean = true;
  let fileExtension: string = '';

  for (let ext of extensions) {
    // If path exists and is a file
    if (fs.existsSync(exportPath + ext) && fs.lstatSync(exportPath + ext).isFile()) {
      // File is present in source code directory
      inNodeModule = false;
      // Save the extension of the file
      fileExtension = ext;
      break;
    }
  }

  if (inNodeModule) {
    // Handle the case of importing from "index" files
    let newExportPath = exportPath + "/index";

    // Re-try the same process as above
    for (let ext of extensions) {
      if (fs.existsSync(newExportPath + ext) && fs.lstatSync(newExportPath + ext).isFile()) {
        inNodeModule = false;
        fileExtension = ext;
        break;
      }
    }

    // Not from node_modules
    if (!inNodeModule) {
      // Save the export path
      exportPath = newExportPath;
    }
  }

  // Exclude imports from node_modules
  if (inNodeModule)
    return null;
  
  // If there is a default import
  if(importedAs)
    // Find the name it is exported as from the export file
    exportedAs = getDefaultExp(exportPath + fileExtension);

  // Ignore any namespace import
  let namespaceImp: string | null = null;

  let returnObj: imports = {
    import: stmt, // Import statement
    defaultImp: {
      importedAs, // Default import present in the import statement
      exportedAs  // Name as it is exported from the file
    },
    namedImps: namedImps, // Named imports present in the import statement
    namespaceImp, // Namespace import present in the import statement
    module: exportPath + fileExtension, // Name of module from which import is happening
  };

  // If there is no default import
  if(importedAs === null)
    // Set it as null
    returnObj.defaultImp = null;

  // Filtering suggestions based on return type of function
  if (filterSuggestions) {

    // If file is not in memo
    if (jsxReturnTypeFunctions.hasOwnProperty(exportPath + fileExtension) === false) {
      let readPath = exportPath + fileExtension;
      // If it is a JS or JSX file
      if(fileExtension !== ".ts" && fileExtension !== ".tsx") {
        // Create a temporary copy of the file with .tsx as
        // TS Compiler API supports only files with .ts/.tsx
        readPath = path.resolve(__dirname, "temp.tsx");
        // Copy file to temporary location
        fs.copyFileSync(exportPath + fileExtension, readPath);
      }
      // Compute the list of all JSX returning functions
      // present in file and store it in the memo
      jsxReturnTypeFunctions[exportPath + fileExtension] = getJsxFunctions(readPath);
    }

    // Get all JSX returning functions in file from memo
    let jsxFuncsInImp = jsxReturnTypeFunctions[exportPath + fileExtension];

    // If default import is not a JSX returning function
    if (exportedAs && jsxFuncsInImp.hasOwnProperty(exportedAs) === false)
      // Remove it from the import object
      returnObj.defaultImp = null;

    // Filtered list of JSX returning named imports
    let newNamedImps: stringToNamedImp[] = [];

    // Loop over all the named imports
    for (let namedImp of namedImps || []) {
      // If named import is not a JSX returning function
      if (namedImp.namedImp && jsxFuncsInImp.hasOwnProperty(namedImp.namedImp) === false)
        continue;
      // Add JSX returning named import to new list
      newNamedImps.push(namedImp);
    }

    // Set the named imports to the filtered named imports
    returnObj.namedImps = newNamedImps;

    // If there are no JSX returning filtered name imports and default import
    if(newNamedImps.length === 0 && returnObj.defaultImp === null)
      // Ignore this import statement too
      return null;
  }

  return returnObj;
}

export type returnGetImports = {
  imports: imports[];
  lazyImps: lazyImp[];
  defaultExportsMemo: defaultExpMemo;
  jsxReturnTypeFunctions: jsxReturningFunctions;
}

// Get an array of import objects for each import statement in the code
export function getImports(
  filePath: string,
  filterSuggestions: boolean,
  defaultExportsMemoLocal: defaultExpMemo,
  jsxReturnTypeFunctionsLocal: jsxReturningFunctions
): returnGetImports {
  // Set the global memos with the memos from Data Generator
  // This is done to persist the memos between calls
  defaultExportsMemo = defaultExportsMemoLocal;
  jsxReturnTypeFunctions = jsxReturnTypeFunctionsLocal;

  // Read the file contents
  const oldcode: string = fs.readFileSync(filePath, "utf8");
  // Get Lazy loaded imports and remove them from code
  let { newcode: code, lazyImps }: getLazy = getLazyImports(oldcode);
  // Declaring variables to store ordinary imports and regex matches
  let imports: imports[] = [], match: RegEx;

  // Remove comments from the code
  code = removeComments(code);
  // Remove single file imports
  code = removeImports(code);

  // Import statements are of the form "import <imports> from <moduleName>;"
  // eslint-disable-next-line no-control-regex
  let reg: RegExp = new RegExp("import((.|\r\n|\\s)*?)?from((.|\r\n|\\s)*?)?;", "gm");

  do {
    // Find each import
    match = reg.exec(code);
    if (match) {
      // Convert the import statement into an object
      let importObj: imports = importToObj(match, filePath, filterSuggestions);

      if (importObj) imports.push(importObj);
    }
  } while (match);

  // Return the imports and updated memos as well
  return { imports, lazyImps, defaultExportsMemo, jsxReturnTypeFunctions };
}
