import fs from "fs";
import path from "path";
import { getComponents } from "./parseRoutes.js";
import { getImports } from "./parseImports.js";

const rootPath = path.resolve(process.argv[2]), writePath = process.argv[3] || "data.json";
const ignore_dirs = ["node_modules", ".git", "build", "scripts", "data.json"].map((folder) => path.join(rootPath, folder));
let data = {
  rootPath,
};

function ignoreDirent(entry) {
  return ignore_dirs.findIndex((ignore) => ignore == entry) != -1;
}

function relPath(dir) {
  return "/" + path.relative(rootPath, dir).replaceAll("\\", "/");
}

function getInitData(name, entryPath, isFile = true) {
  entryPath = entryPath.replaceAll("\\", "/");
  return isFile
    ? {
        name,
        path: entryPath,
        size: 0,
        type: path.extname(name),
        totalLazyLoaded: [],
        canBeLazyLoaded: [],
        parentFolder: relPath(path.dirname(entryPath)),
      }
    : {
        name,
        path: entryPath,
        size: 0,
        noOfSubFolders: 0,
        noOfSubFiles: 0,
        totalLazyLoaded: 0,
        canBeLazyLoaded: 0,
        foldersInside: [],
        filesInside: [],
        parentFolder: relPath(path.dirname(entryPath)),
      };
}

function addFile(filePath) {
  let fileData = getInitData(filePath.substring(filePath.lastIndexOf('/') + 1), filePath);
  let components = getComponents(filePath), folderPath = path.dirname(filePath);

  fileData.size = fs.statSync(filePath).size;

  if(components.length) {
    let {lazyImps, imports} = getImports(filePath);
    
    for(let comp of components) {
      let toBeLazyLoaded = false;
      for(let imp of imports) {
        if(comp == imp.defaultExp || comp == imp.namespaceExp)
          toBeLazyLoaded = true;
        else if(imp.namedExps) {
          for(let namedImp of imp.namedExps) {
            if(namedImp.alias != undefined) {
              if(namedImp.alias == comp)
                toBeLazyLoaded = true;
            }
            else if(namedImp.namedExp == comp)
              toBeLazyLoaded = true;
            if(toBeLazyLoaded)
              break;
          }
        }
        if(toBeLazyLoaded) {
          let relImpPath = relPath(path.resolve(folderPath, imp.module));
          fileData.canBeLazyLoaded.push({name: comp, path: relImpPath});
          break;
        }
      }

      if(!toBeLazyLoaded)
        for(let lazyImp of lazyImps) {
          if(comp == lazyImp.lazyImp) {
            let relImpPath = relPath(path.resolve(folderPath, lazyImp.module));
            fileData.totalLazyLoaded.push({name: comp, path: relImpPath});
            break;
          }
        }
    }
  }
  return fileData;
}

function walk(dir, callback) {
  let dirData = getInitData(dir.substring(dir.lastIndexOf('/') + 1), dir, false);

  let entries = fs.readdirSync(dir, { withFileTypes: true });

  entries.forEach(function (dirent) {
    let entry = dirent.name;
    const entryPath = path.join(dir, entry);

    if (!ignoreDirent(entryPath))
      if (dirent.isDirectory()) {
        let recData = walk(entryPath, callback);

        let properties = ["size", "noOfSubFolders", "noOfSubFiles", "totalLazyLoaded", "canBeLazyLoaded"];
        for(let property of properties)
          dirData[property] += recData[property];

        dirData.noOfSubFolders++;
        dirData.foldersInside.push(relPath(entryPath));
      }
      else if (dirent.isFile()) {
        let recData = addFile(entryPath);
        data[relPath(entryPath)] = recData;

        dirData.size += recData.size;
        dirData.noOfSubFiles++;
        dirData.totalLazyLoaded += recData.totalLazyLoaded.length;
        dirData.canBeLazyLoaded += recData.canBeLazyLoaded.length;
        dirData.filesInside.push(relPath(entryPath));
      }
  });

  data[relPath(dir)] = dirData;
  return dirData;
}

walk(rootPath);
data["/"].parentFolder = "/";
fs.writeFile(writePath, JSON.stringify(data, undefined, 2), e => e ? console.log(e) : "");
