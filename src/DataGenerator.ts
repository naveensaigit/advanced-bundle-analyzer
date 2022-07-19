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

// Information stored for a file.
type fileData = {
  name: string,
  path: string,
  size: number,
  type: string,
  alreadyLazyLoaded: string[],
  canBeLazyLoaded: string[],
  canNotBeLazyLoaded: string[]
}

type outputObject = {
  [key: string]: fileData
}

// These are the files which we are considering empty extension is used to match for the files whose extension is already given in the import statement path.
let extensions: string[] = ['', '.js', '.jsx', '.ts', '.tsx'];

let dataObject: outputObject = {};

let renderTree: renderTreeType = {};

// Function to get initial object to store file data.
function getFileInitData(name: string, entryPath: string): fileData {
  // Replace \\ with / for consistency (for Windows paths).
  entryPath = entryPath.replaceAll("\\", "/");
  return {
    name,
    path: entryPath,
    size: 0,
    type: path.extname(name),
    alreadyLazyLoaded: [],
    canBeLazyLoaded: [],
    canNotBeLazyLoaded: []
  }
}

for (let node in renderTree) {
  if (renderTree[node].hasOwnProperty('source') === false)
    continue;

  let filePath = renderTree[node].source.fileName;

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
      let importModulePath = path.resolve(path.dirname(filePath), imp.module);

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
      if (imp.defaultImp) {
        fileData.canBeLazyLoaded.push(importModulePath + ':' + imp.defaultImp.importedAs + ':' + imp.defaultImp.exportedAs);
      }

      // If the component is being imported as namespace import.
      if (imp.namespaceImp) {
        fileData.canBeLazyLoaded.push(importModulePath + ':' + imp.namespaceImp + ':' + imp.namespaceImp);
      }

      // Getting components from named import
      for (let namedImp of imp.namedImps || []) {
        if (namedImp.alias !== undefined) {
          fileData.canBeLazyLoaded.push(importModulePath + ':' + namedImp.namedImp + ':' + namedImp.alias);
        }

        // Getting components from named import.
        if (namedImp.alias === undefined && namedImp.namedImp !== undefined) {
          fileData.canBeLazyLoaded.push(importModulePath + ':' + namedImp.namedImp + ':' + namedImp.namedImp);
        }
      }
    }

    // Loop over all dynamic / lazy imports.
    for (let lazyImp of lazyImps) {
      if (lazyImp.lazyImp) {

        let importModulePath = path.resolve(path.dirname(filePath), lazyImp.module);

        for (let extension of extensions) {
          if (fs.existsSync(importModulePath + extension)) {
            importModulePath += extension;
            break;
          }
        }

        if (!fs.existsSync(importModulePath))   // If the file is not present in the path mentioned in the import statement, it is imported from node modules. 
          continue;

        importModulePath = importModulePath.replaceAll('\\', '/');

        fileData.alreadyLazyLoaded.push(importModulePath + ':' + lazyImp.lazyImp);
      }
    }

    dataObject[filePath] = fileData;
  }

  // Getting name from component rendering statement.
  let code: string = fs.readFileSync(filePath, "utf8");

  const lineNumber: number = renderTree[node].source.lineNumber;
  const ColumnNumber: number = renderTree[node].source.columnNumber;

  let numberOfCharacters = 0;   // For finding number of characters present in file before the render statement.
  let line = 1, col=1;

  while(line!==lineNumber || col!==ColumnNumber){
    col++;

    if(code[numberOfCharacters]==='\n'){
      line++;
      col=1;
    }

    numberOfCharacters++;
  }

  // Remove the code present before the render statement of the current component.
  code = code.substring(numberOfCharacters+1, code.length);

  // Get the render statement by removing excess code after '>'.
  let renderStatement: string = code.substring(0, code.indexOf('>'));

  // Get all the keywords/words present in the render statement of the current component.
  const keywords = renderStatement.split(/[^a-zA-Z0-9_$]+/gm);

  // Loop over all the imports that can still be lazy loaded for the current file & match those with the current component.
  for (let imp of dataObject[filePath].canBeLazyLoaded) {
    let found = false;

    let importDetails = imp.split(':');

    let exportName = importDetails[importDetails.length-1];
    let importName = importDetails[importDetails.length-2];

    for (let word of keywords) {
      if (word === importName && exportName === renderTree[node].name) {
        found = true;

        //If the current child component is rendered we remove it from can be lazy loaded for the current file (in which the parent component resides).
        let index: number = dataObject[filePath].canBeLazyLoaded.indexOf(imp);
        dataObject[filePath].canNotBeLazyLoaded.push(imp);
        dataObject[filePath].canBeLazyLoaded.splice(index, index + 1);
      }
    }

    if (found){
      // If the current component has already matched one of the imports, we don't need to match it with any other components.
      break;
    }
  }
}