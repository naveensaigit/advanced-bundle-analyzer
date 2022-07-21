import path from "path";
import fs from "fs";
import { getImports } from "./parseImports.js";
import { returnGetImports } from './parseImports';

type sourceObject = {
  fileName: string,
  lineNumber: number,
  columnNumber: number
}

// Type of value corresponding to a key in render tree.
type componentInfo = {
  name: string,
  source: sourceObject
};

type renderTreeType = {
  [key: string]: componentInfo
};

type importStatements = {
  path: string,
  exportName: string | null
}

type canBeLazy = {
  [key: string]: importStatements     // Here key is the importName used for importing a component in a file.
}

// Information stored for a file.
type fileData = {
  name: string,
  path: string,
  size: number,
  type: string,
  alreadyLazyLoaded: number,
  canBeLazyLoaded: canBeLazy,
  canNotBeLazyLoaded: number
}

type outputObject = {
  [key: string]: fileData
}

//
const readPath:string = path.resolve(process.argv[2]), writePath: string = process.argv[3] || "data.json";

// These are the files which we are considering empty extension is used to match for the files whose extension is already given in the import statement path.
let extensions: string[] = ['', '.js', '.jsx', '.ts', '.tsx'];

let dataObject: outputObject = {};

let renderTree: renderTreeType = JSON.parse(fs.readFileSync(readPath).toString());

// Function to get initial object to store file data.
function getFileInitData(name: string, entryPath: string): fileData {
  // Replace \\ with / for consistency (for Windows paths).
  entryPath = entryPath.replaceAll("\\", "/");
  return {
    name,
    path: entryPath,
    size: 0,
    type: path.extname(name),
    alreadyLazyLoaded: 0,
    canBeLazyLoaded: {},
    canNotBeLazyLoaded: 0
  }
}

type dontLazyLoad = {
  path: string,
  exportName: string | null
}

let notToBeLazyLoaded: { [key: string]: dontLazyLoad } = {};

for (let node in renderTree) {
  if (renderTree[node].hasOwnProperty('source') === false)
    continue;

  let filePath: string = renderTree[node].source.fileName;

  // check this file is in memo or not

  filePath = filePath.replaceAll('\\', '/');

  if (dataObject.hasOwnProperty(filePath) === false) {
    // If we don't have any Information regarding the current files imports in dataObject we need to run parse imports once for the current file.

    let fileData: fileData = getFileInitData(path.basename(filePath), filePath);
    fileData.size = fs.statSync(filePath).size;     // computing size of current file.
    let { lazyImps, imports }: returnGetImports = getImports(filePath);

    for (let imp of imports) {
      if (!imp || !imp.module)
        continue;

      // Absolute path of file from which the current imported component is exported.
      let importModulePath: string = path.resolve(path.dirname(filePath), imp.module);

      for (let extension of extensions) {
        if (fs.existsSync(importModulePath + extension)) {
          // Adding the file extensions & checking if the current file is actually present in the path received from import statement.
          importModulePath += extension;
          break;
        }
      }

      if (!fs.existsSync(importModulePath))   // If the file is not present in the path mentioned in the import statement, it is imported from node modules. 
        continue;

      importModulePath = importModulePath.replaceAll('\\', '/');

      // Initially all the components from default, namespace & named imports are considered as can be lazy loaded.

      // If the component is being imported as a default import.
      if (imp.defaultImp !== null && imp.defaultImp.importedAs !== null) {
        fileData.canBeLazyLoaded[imp.defaultImp.importedAs] =
        {
          path: importModulePath,
          exportName: imp.defaultImp.exportedAs
        };
      }

      // If the component is being imported as namespace import.
      if (imp.namespaceImp) {
        fileData.canBeLazyLoaded[imp.namespaceImp] =
        {
          path: importModulePath,
          exportName: imp.namespaceImp
        }
      }

      // Getting components from named import
      for (let namedImp of imp.namedImps || []) {
        if (namedImp.alias !== undefined && namedImp.namedImp !== null) {
          fileData.canBeLazyLoaded[namedImp.namedImp] =
          {
            path: importModulePath,
            exportName: namedImp.alias
          }
        }

        // Getting components from named import.
        if (namedImp.alias === undefined && namedImp.namedImp !== undefined) {
          fileData.canBeLazyLoaded[namedImp.namedImp] =
          {
            path: importModulePath,
            exportName: namedImp.namedImp
          }
        }
      }
    }

    // Loop over all dynamic / lazy imports.
    for (let lazyImp of lazyImps) {
      if (lazyImp.lazyImp) {

        let importModulePath: string = path.resolve(path.dirname(filePath), lazyImp.module);

        for (let extension of extensions) {
          if (fs.existsSync(importModulePath + extension)) {
            importModulePath += extension;
            break;
          }
        }

        if (!fs.existsSync(importModulePath))   // If the file is not present in the path mentioned in the import statement, it is imported from node modules. 
          continue;

        //importModulePath = importModulePath.replaceAll('\\', '/');

        //fileData.alreadyLazyLoaded.push(importModulePath + ':' + lazyImp.lazyImp);
        fileData.alreadyLazyLoaded++;
      }
    }

    dataObject[filePath] = fileData;
  }

  // Getting name from component rendering statement.
  let code: string = fs.readFileSync(filePath, "utf8");

  const lineNumber: number = renderTree[node].source.lineNumber;
  const ColumnNumber: number = renderTree[node].source.columnNumber;

  let numberOfCharacters: number = 0;   // For finding number of characters present in file before the render statement.
  let line: number = 1, col: number = 1;

  while (line !== lineNumber || col !== ColumnNumber) {
    col++;

    if (code[numberOfCharacters] === '\n') {
      line++;
      col = 1;
    }

    numberOfCharacters++;
  }

  // Remove the code present before the render statement of the current component.
  code = code.substring(numberOfCharacters + 1, code.length);

  // Get the render statement by removing excess code after '>'.
  let renderStatement: string = code.substring(0, code.indexOf('>'));

  // Get all the keywords/words present in the render statement of the current component.
  const keywords: string[] = renderStatement.split(/[^a-zA-Z0-9_$]+/gm);

  // Loop over all the imports that can still be lazy loaded for the current file & match those with the current component.
  for (let imp in dataObject[filePath].canBeLazyLoaded) {
    let found: boolean = false;

    let importDetails: importStatements = dataObject[filePath].canBeLazyLoaded[imp];

    for (let word of keywords) {
      if (imp === word && importDetails.exportName === renderTree[node].name) {
        found = true;

        //If the current child component is rendered we remove it from can be lazy loaded for the current file (in which the parent component resides).
        //let index: number = dataObject[filePath].canBeLazyLoaded.indexOf(imp);
        dataObject[filePath].canNotBeLazyLoaded++;
        //dataObject[filePath].canBeLazyLoaded.splice(index, index + 1);

        delete dataObject[filePath].canBeLazyLoaded[imp];

        let key: string = importDetails.path + ':' + importDetails.exportName;

        if (notToBeLazyLoaded.hasOwnProperty(key))
          continue;

        notToBeLazyLoaded[key] =
        {
          path: importDetails.path,
          exportName: importDetails.exportName
        }
      }
    }

    if (found) {
      // If the current component has already matched one of the imports, we don't need to match it with any other components.
      break;
    }
  }

  // Loop over all the components that cant be lazy loaded 
  for (let imp in notToBeLazyLoaded) {
    // loop over all the file values in dataObject

    for (let file in dataObject) {
      // For the current file, remove the current component if it's in canBeLazyLoaded array 

      for (let canLazyLoad in dataObject[file].canBeLazyLoaded) {
        let importDetails: importStatements = dataObject[file].canBeLazyLoaded[canLazyLoad];

        if (importDetails.path === notToBeLazyLoaded[imp].path && importDetails.exportName === notToBeLazyLoaded[imp].exportName) {
          delete dataObject[file].canBeLazyLoaded[canLazyLoad];
          dataObject[file].canNotBeLazyLoaded++;
          break;
        }
      }
    }
  }
}

fs.writeFileSync(writePath, JSON.stringify(dataObject, undefined, 2));