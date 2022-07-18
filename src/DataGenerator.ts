import path from "path";
import fs from "fs";
import { getImports } from "./parseImports.js";
import { returnGetImports } from './parseImports';

// Type of value corresponding to a key in render tree.
type componentInfo = {
  name: string,
  filePath: string,
  childComponents: string
};

type renderTreeType = {
  [key: string]: componentInfo      // Key's structure -> 'path_of_file_where_is_defined:component_name'.
};

// Type to store the components in totalLazyLoaded, canBeLazyLoaded & alreadyLazyLoaded.
type component = {
  name: string,
  path: string
}

// Information stored for a file.
type fileData = {
  name: string,
  path: string,
  size: number,
  type: string,
  alreadyLazyLoaded: component[],
  canBeLazyLoaded: component[],
  canNotBeLazyLoaded: component[]
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

function dfs(node: string): void {
  if (!node || !node.length) return;

  let filePath: string = renderTree[node].filePath;
  /*let filePath = node.slice(0, node.lastIndexOf(':'));*/

  if (!dataObject.hasOwnProperty(filePath)) {
    // If we don't have any Information regarding the current files imports in dataObject we need to run parse imports once for the current file.

    let fileData: fileData = getFileInitData(path.basename(filePath), filePath);
    fileData.size = fs.statSync(filePath).size;     // computing size of current file.
    let { lazyImps, imports }: returnGetImports = getImports(filePath);

    // Loop over the import statements.
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
        fileData.canBeLazyLoaded.push({
          "name": imp.defaultImp,
          "path": importModulePath
        });
      }

      // If the component is being imported as namespace import.
      if (imp.namespaceImp) {
        fileData.canBeLazyLoaded.push({
          "name": imp.namespaceImp,
          "path": importModulePath
        });
      }

      // Getting components from named import
      for (let namedImp of imp.namedImps || []) {
        if (namedImp.alias !== undefined) {
          fileData.canBeLazyLoaded.push({
            "name": namedImp.alias,
            "path": importModulePath
          });
        }

        // Getting components from named import.
        if (namedImp.alias === undefined && namedImp.namedImp !== undefined) {
          fileData.canBeLazyLoaded.push({
            "name": namedImp.namedImp,
            "path": importModulePath
          });
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

        fileData.alreadyLazyLoaded.push({
          "name": lazyImp.lazyImp,
          "path": importModulePath
        });
      }
    }

    dataObject[filePath] = fileData;
  }

  // loop over all the child component of the current component, that are present in the render tree.
  for (let childComponent of renderTree[filePath].childComponents) {
    //Object representation for the current childComponent.
    let obj: component = {
      name: childComponent.slice(childComponent.lastIndexOf(':') + 1, childComponent.length),
      path: childComponent.slice(0, childComponent.lastIndexOf(':'))
    };

    if (dataObject[filePath].canBeLazyLoaded.indexOf(obj) !== -1) {
      //If the current child component is rendered we remove it from can be lazy loaded for the current file (in which the parent component resides).
      let index: number = dataObject[filePath].canBeLazyLoaded.indexOf(obj);
      dataObject[filePath].canNotBeLazyLoaded.push(obj);
      dataObject[filePath].canBeLazyLoaded.splice(index, index);
    }
  }

  // calling dfs function for all the child components of the current component, that are present in the render tree.
  for (let childComponent of renderTree[filePath].childComponents) {
    dfs(childComponent);
  }

  console.log(dataObject);
}

// calling dfs function with 'path_of_where_root_component_is_definition:root_component_name', where root component represents the root node of render tree.
dfs("C:/Users/Sprinklr/Desktop/practice/New folder/react-crypto-tracker/src/App.js:root");