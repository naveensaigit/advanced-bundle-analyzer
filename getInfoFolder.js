import { parseDirectory } from "./parseDirectory.js";
import { getInfoFiles } from "./getInfoFiles.js";

let output = "";

function getKeyValue(
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
  let foldersInsideString = foldersInside.join('", "');
  let filesInsideString = filesInside.join('", "');

  if (foldersInside.length)
    foldersInsideString = '"' + foldersInsideString + '"';
  if (filesInside.length) filesInsideString = '"' + filesInsideString + '"';

  return `
  "${path}": {
    "name": "${name}",
    "path": "${path}",
    "size": ${size},
    "noOfSubFolders": ${noOfSubFolders},
    "noOfSubFiles": ${noOfSubFiles},
    "alreadyLazyLoaded": ${alreadyLazyLoaded},
    "canBeLazyLoaded": ${canBeLazyLoaded},
    "foldersInside": [${foldersInsideString}],
    "filesInside": [${filesInsideString}],
    "parentFolder": "${parentDirectory}"
  },`;
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
  output += filesCombinedInfo.output;

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
  }

  let KeyValue = getKeyValue(
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
  output += "\r\n" + KeyValue;

  return {
    noOfSubFiles,
    noOfSubFolders,
    alreadyLazyLoaded,
    canBeLazyLoaded,
    size,
  };
}

export function getInfoFolder(path) {
  getInfo(path, "/");

  output = output.slice(5, -1);
  output = `{
  ${output}
}`;

  return output;
}
