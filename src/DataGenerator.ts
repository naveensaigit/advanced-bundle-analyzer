import path from "path";
import fs from "fs";
import { getImports } from "./parseImports.js";
import { returnGetImports } from './parseImports';

type componentInfo = {
  name: string,
  filePath: string,
  childComponents: string
};

type renderTreeType = {
  [key: string]: componentInfo
};

type component = {
  name: string,
  path: string
}

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

let extensions: string[] = ['', '.js', '.jsx', '.ts', '.tsx'];

let dataObject: outputObject = {};

let renderTree: renderTreeType = {};

function getFileInitData(name: string, entryPath: string): fileData {
  // Replace \\ with / for consistency (for Windows paths)
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

    let fileData: fileData = getFileInitData(path.basename(filePath), filePath);
    let { lazyImps, imports }: returnGetImports = getImports(filePath);

    for (let imp of imports) {
      if (!imp || !imp.module)
        continue;

      let importModulePath = path.resolve(path.dirname(filePath), imp.module);

      for (let extension of extensions) {
        if (fs.existsSync(importModulePath + extension)) {
          importModulePath += extension;
          break;
        }
      }

      if (!fs.existsSync(importModulePath))
        continue;

      importModulePath = importModulePath.replaceAll('\\', '/');
      
      if (imp.defaultImp) {
        fileData.canBeLazyLoaded.push({
          "name": imp.defaultImp,
          "path": importModulePath
        });
      }

      if (imp.namespaceImp) {
        fileData.canBeLazyLoaded.push({
          "name": imp.namespaceImp,
          "path": importModulePath
        });
      }

      for (let namedImp of imp.namedImps || []) {
        if (namedImp.alias !== undefined) {
          fileData.canBeLazyLoaded.push({
            "name": namedImp.alias,
            "path": importModulePath
          });
        }

        if (namedImp.alias === undefined && namedImp.namedImp !== undefined) {
          fileData.canBeLazyLoaded.push({
            "name": namedImp.namedImp,
            "path": importModulePath
          });
        }
      }
    }

    for (let lazyImp of lazyImps) {
      if (lazyImp.lazyImp) {

        let importModulePath = path.resolve(path.dirname(filePath), lazyImp.module);

        for (let extension of extensions) {
          if (fs.existsSync(importModulePath + extension)) {
            importModulePath += extension;
            break;
          }
        }
  
        if (!fs.existsSync(importModulePath))
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

  for (let childComponent of renderTree[filePath].childComponents) {
    let obj: component = {
      name: childComponent.slice(childComponent.lastIndexOf(':') + 1, childComponent.length),
      path: childComponent.slice(0, childComponent.lastIndexOf(':'))
    };

    if (dataObject[filePath].canBeLazyLoaded.indexOf(obj) !== -1) {
      let index: number = dataObject[filePath].canBeLazyLoaded.indexOf(obj);
      dataObject[filePath].canNotBeLazyLoaded.push(obj);
      dataObject[filePath].canBeLazyLoaded.splice(index, index);
    }
  }

  for (let childComponent of renderTree[filePath].childComponents) {
    dfs(childComponent);
  }

  console.log(dataObject);
}

dfs("C:/Users/Sprinklr/Desktop/practice/New folder/react-crypto-tracker/src/App.js:root");