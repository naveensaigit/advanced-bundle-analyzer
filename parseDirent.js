import fs from "fs";
import { getComponents } from "./parseRoutes.js";
import { getImports } from "./parseImports.js";

function getKeyValueFile(
  name,
  filePath,
  size,
  type,
  alreadyLazyLoaded,
  canBeLazyLoaded,
  parentDirectory
) {
  const obj = {
    [filePath]: {
      name: name,
      path: filePath,
      size: size,
      type: type,
      alreadyLazyLoaded: alreadyLazyLoaded,
      canBeLazyLoaded: canBeLazyLoaded,
      parentFolder: parentDirectory,
    },
  };

  return obj;
}

function getKeyValueFolder(
  name,
  path,
  size,
  alreadyLazyLoaded,
  canBeLazyLoaded,
  noOfSubFiles,
  noOfSubFolders,
  foldersInside,
  filesInside,
  parentDirectory
) {
  const obj = {
    [path]: {
      name: name,
      path: path,
      size: size,
      noOfSubFolders: noOfSubFolders,
      noOfSubFiles: noOfSubFiles,
      alreadyLazyLoaded: alreadyLazyLoaded,
      canBeLazyLoaded: canBeLazyLoaded,
      foldersInside: foldersInside,
      filesInside: filesInside,
      parentFolder: parentDirectory,
    },
  };

  return obj;
}

function getLazyLoaded(
  alreadyLazyLoaded,
  canBeLazyLoaded,
  components,
  imports
) {
  for (let component of components) {
    for (let importLine of imports) {
      if (component === importLine.defaultExp) {
        canBeLazyLoaded.push({ name: component, module: importLine.module });
        break;
      }
      if (component === importLine.lazyImp) {
        alreadyLazyLoaded.push({ name: component, module: importLine.module });
        break;
      }
    }
  }
}

function modify(loaded, filePath) {
  const obj = loaded.map((component) => {
    let parentFolder = "";
    if (component.module[1] === ".") {
      parentFolder = `"${filePath.substr(0, filePath.lastIndexOf("/"))}`;
      component.module = component.module.substr(2, component.module.length);
    }

    let path = parentFolder + component.module;

    const nestedObj = {
      name: component.name,
      path: path.slice(1, -1),
    };

    return nestedObj;
  });

  return obj;
}

export function parseFile(filePath) {
  const data = fs.readFileSync(filePath, "utf8");

  let code = data.toString();
  let components = getComponents(code);
  let imports = [];

  if (components.length) imports = getImports(code);

  let canBeLazyLoaded = [];
  let alreadyLazyLoaded = [];
  getLazyLoaded(alreadyLazyLoaded, canBeLazyLoaded, components, imports);

  let noOfCanBeLazyLoaded = canBeLazyLoaded.length;
  let noOfAlreadyLazyLoaded = alreadyLazyLoaded.length;

  alreadyLazyLoaded = modify(alreadyLazyLoaded, filePath);
  canBeLazyLoaded = modify(canBeLazyLoaded, filePath);

  return {
    canBeLazyLoaded,
    noOfCanBeLazyLoaded,
    alreadyLazyLoaded,
    noOfAlreadyLazyLoaded,
  };
}

function getInfo(path, parentDirectory) {
  let name = path.replace(/^.*[\\/]/, "");
  let size = 0;
  let noOfSubFolders = 0;
  let noOfSubFiles = 0;
  let alreadyLazyLoaded = 0;
  let canBeLazyLoaded = 0;
  let foldersInside = [];
  let filesInside = [];

  let directoryInfo = parseDirectory(path);
  let files = directoryInfo.files;
  let folders = directoryInfo.folders;

  let filesCombinedInfo = getInfoFiles(files, path, filesInside);

  alreadyLazyLoaded = filesCombinedInfo.totalAlreadyLazy;
  canBeLazyLoaded = filesCombinedInfo.totalCanBeLazy;
  noOfSubFiles = files.length;
  size = filesCombinedInfo.totalSize;
  let output = filesCombinedInfo.output;

  for (let folder of folders) {
    if (folder === ".git" || folder === ".vscode" || folder === "node_modules")
      continue;

    let childFolderPath = path + "/" + folder;

    let folderInfo = getInfo(childFolderPath, path);

    foldersInside.push(`${childFolderPath}`);
    canBeLazyLoaded += folderInfo.canBeLazyLoaded;
    alreadyLazyLoaded += folderInfo.alreadyLazyLoaded;
    size += folderInfo.size;
    noOfSubFiles += folderInfo.noOfSubFiles;
    noOfSubFolders += folderInfo.noOfSubFolders + 1;

    output = Object.assign(output, folderInfo.output);
  }

  let KeyValue = getKeyValueFolder(
    name,
    path,
    size,
    alreadyLazyLoaded,
    canBeLazyLoaded,
    noOfSubFiles,
    noOfSubFolders,
    foldersInside,
    filesInside,
    parentDirectory
  );

  output = Object.assign(output, KeyValue);

  return {
    noOfSubFiles,
    noOfSubFolders,
    alreadyLazyLoaded,
    canBeLazyLoaded,
    size,
    output,
  };
}

export function getInfoFolder(path) {
  let output = getInfo(path, "/").output;

  return output;
}

export function getInfoFiles(files, parentDirectory, filesInside) {
  let totalSize = 0;
  let totalAlreadyLazy = 0;
  let totalCanBeLazy = 0;
  let output = {};

  for (let file of files) {
    let filePath = parentDirectory + "/" + file;
    let size = fs.statSync(filePath).size;
    totalSize += size;

    let fileExtension = file.substring(file.lastIndexOf(".") + 1, file.length);
    let canBeLazyLoaded = [];
    let alreadyLazyLoaded = [];

    if (
      fileExtension === "js" ||
      fileExtension === "jsx" ||
      fileExtension === "ts" ||
      fileExtension === "tsx"
    ) {
      let fileInfo = parseFile(filePath);
      canBeLazyLoaded = fileInfo.canBeLazyLoaded;
      alreadyLazyLoaded = fileInfo.alreadyLazyLoaded;

      totalCanBeLazy += fileInfo.noOfCanBeLazyLoaded;
      totalAlreadyLazy += fileInfo.noOfAlreadyLazyLoaded;
    }

    let KeyValue = getKeyValueFile(
      file,
      filePath,
      size,
      fileExtension,
      alreadyLazyLoaded,
      canBeLazyLoaded,
      parentDirectory
    );

    output = Object.assign(output, KeyValue);
    filesInside.push(filePath);
  }

  return { totalSize, totalAlreadyLazy, totalCanBeLazy, output };
}

function getFilesAndFolders(data) {
  let folders = data
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
  let files = data
    .filter((dirent) => !dirent.isDirectory())
    .map((dirent) => dirent.name);

  return { files, folders };
}

export function parseDirectory(dirPath) {
  const data = fs.readdirSync(dirPath, { withFileTypes: true });

  return getFilesAndFolders(data);
}
