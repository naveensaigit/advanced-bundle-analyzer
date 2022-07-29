import fs from "fs";
import path from "path";
import { preprocess, removeComments } from "./utils.js";

type lazyImp = { import: string; lazyImp: string; module: string };
type getLazy = { newcode: string; lazyImps: lazyImp[] };
type RegEx = RegExpExecArray | null;

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
    let defaultImpStr: string = preprocess(defaultImp[4]);
    return defaultImpStr;
  }

  return null;
}

let defaultExportsMemo : {[key: string]: string | null} = {};

// Get name of default export from a file
function getDefaultExp(filePath: string): string | null {

  if(typeof defaultExportsMemo[filePath] !== "undefined")
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
    return defaultExportsMemo[filePath] = preprocess(match[7]);

  // Match "export default expression"
  const expDef: RegExp = new RegExp(
    "export((\r\n|\\s)*?)?default((\r\n|\\s)*?)?((\r\n|\\s)*)?([^\n;]*)",
    "gm"
  );

  match = expDef.exec(code);
  if (match && match[7])
    return defaultExportsMemo[filePath] = preprocess(match[7]);

  // Match "export { name as default }"
  const nameDef: RegExp = new RegExp(
    "export((\r\n|\\s)*?)?{((\r\n|\\s|.)*)}",
    "gm"
  );

  match = nameDef.exec(code);
  if (!(match && match[3]))
    return defaultExportsMemo[filePath] = "";
  const namedExps: string[] = preprocess(match[3]).split(",");
  for (let namedExp of namedExps) {
    const [name, exportedAs] = namedExp.split("as");
    if (exportedAs.trim() === "default")
      return defaultExportsMemo[filePath] = name.trim();
  }

  return defaultExportsMemo[filePath] = null;
}

// Get namespace import from an import statement
function getNamespaceImp(stmt: string): string | null {
  // Namespace import contains "* as". It can
  // be succeeded by either a "," or "from"
  let namespaceImpRegEx: RegExp = new RegExp(
    // eslint-disable-next-line no-control-regex
    "\\*((.|\r\n|\\s)*?)?as((.|\r\n|\\s)*?)?((.|\r\n|\\s)*?)(,|from)",
    "gm"
  );

  let namespaceImp: RegEx = namespaceImpRegEx.exec(stmt);

  if (namespaceImp) {
    // Taking the fifth element to get the fifth group
    // from regex which contains the namespace import

    // Remove trailing whitespaces and newlines
    let namespaceImpStr: string = preprocess(namespaceImp[5].toString());
    return namespaceImpStr;
  }

  return null;
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
function importToObj(imp: RegExpExecArray, filePath: string): imports {
  if (!imp) return null;

  let module = imp[3].match(/('|")(.*)('|")/gm);
  let moduleStr: string | undefined = module?.[0];

  if (!moduleStr) return null;
  moduleStr = moduleStr.slice(1, -1);

  let stmt: string = imp[0];

  let namedImps: stringToNamedImp[] | null = getNamedImps(stmt);

  let importedAs: string | null = getDefaultImp(stmt);
  let exportPath = path.resolve(path.dirname(filePath), moduleStr);
  let exportedAs: string | null;

  // checking export path does not lie in node_modules
  let extensions: string[] = ['', '.js', '.jsx', '.ts', '.tsx'];
  let inNodeModule: boolean = true;
  let fileExtension: string = '';

  for (let ext of extensions) {
    if (fs.existsSync(exportPath + ext) && fs.lstatSync(exportPath + ext).isFile()) {
      inNodeModule = false;
      fileExtension = ext;
      break;
    }
  }

  if (inNodeModule) {
    let newExportPath = exportPath + "/index";

    for (let ext of extensions) {
      if (fs.existsSync(newExportPath + ext) && fs.lstatSync(newExportPath + ext).isFile()) {
        inNodeModule = false;
        fileExtension = ext;
        break;
      }
    }

    if (!inNodeModule) {
      exportPath = newExportPath;
    }
  }

  if (!inNodeModule)
    exportedAs = getDefaultExp(exportPath + fileExtension);
  else
    exportedAs = importedAs;

  let namespaceImp: string | null = getNamespaceImp(stmt);

  return {
    import: stmt, // Import statement
    defaultImp: {
      importedAs, // Default import present in the import statement
      exportedAs  // Name as it is exported from the file
    },
    namedImps: namedImps, // Named imports present in the import statement
    namespaceImp, // Namespace import present in the import statement
    module: exportPath+fileExtension, // Name of module from which import is happening
  };
}

export type returnGetImports = {
  imports: imports[];
  lazyImps: lazyImp[];
}

// Get an array of import objects for each import statement in the code
export function getImports(filePath: string): returnGetImports {
  // Read the file contents
  const oldcode: string = fs.readFileSync(filePath, "utf8");
  // Get Lazy loaded imports and remove them from code
  let { newcode: code, lazyImps }: getLazy = getLazyImports(oldcode);
  // Declaring variables to store ordinary imports and regex matches
  let imports: imports[] = [],
    match: RegEx;

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
      let importObj: imports = importToObj(match, filePath);
      imports.push(importObj);
    }
  } while (match);

  return { imports, lazyImps };
}
