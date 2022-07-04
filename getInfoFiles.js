import { parseFile } from "./parseFile.js";
import fs from "fs";

function getKeyValue(
  name,
  filePath,
  size,
  type,
  alreadyLazyLoaded,
  canBeLazyLoaded,
  parentDirectory
) {
  return `
  "${filePath}": {
    "name": "${name}",
    "path": "${filePath}",
    "size": ${size},
    "type": "${type}",
    "alreadyLazyLoaded": [${alreadyLazyLoaded}],
    "canBeLazyLoaded": [${canBeLazyLoaded}],
    "parentFolder": "${parentDirectory}"
  },`;
}

export function getInfoFiles(files, parentDirectory, filesInside) {
  let totalSize = 0;
  let totalAlreadyLazy = 0;
  let totalCanBeLazy = 0;
  let output = "";

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

    let KeyValue = getKeyValue(
      file,
      filePath,
      size,
      fileExtension,
      alreadyLazyLoaded,
      canBeLazyLoaded,
      parentDirectory
    );

    output += "\r\n" + KeyValue;
    filesInside.push(filePath);
  }

  return { totalSize, totalAlreadyLazy, totalCanBeLazy, output };
}
