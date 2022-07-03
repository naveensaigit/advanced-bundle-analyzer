import fs from "fs";

let files = [];
let folders = [];

function getFilesAndFolders(data) {
  folders = data
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
  files = data
    .filter((dirent) => !dirent.isDirectory())
    .map((dirent) => dirent.name);
}

export function parseDirectory(dirPath) {
  const data = fs.readdirSync(dirPath, { withFileTypes: true });

  getFilesAndFolders(data);

  return { files, folders };
}
