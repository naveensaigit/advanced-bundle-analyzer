import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { getComponents } from "./parseRoutes.js";
import { getImports } from "./parseImports.js";

// Type to store the components in totalLazyLoaded or canBeLazyLoaded
type component = {
  name: string,
  path: string
}

// Information stored for a file
type fileData = {
  name: string,
  path: string,
  size: number,
  type: string,
  totalLazyLoaded: component[],
  canBeLazyLoaded: component[],
  parentFolder: string,
  [key: string]: any
}

// Information stored for a folder
type folderData = {
  name: string,
  path: string,
  size: number,
  noOfSubFolders: number,
  noOfSubFiles: number,
  totalLazyLoaded: number,
  canBeLazyLoaded: number,
  foldersInside: string[],
  filesInside: string[],
  parentFolder: string,
  [key: string]: any
}

// Type for global data object
// "entry" - fileData or folderData
type data = {
  [key: string]: fileData | folderData
}

// Path of root folder
const rootPath:string = path.resolve(process.argv[2]), writePath: string = process.argv[3] || "data.json";
// Git command to get all ignored folders and files present in .gitignore
const ignore_cmd: string = "git ls-files -o -i --exclude-standard --directory";
// Some folders and files which may not be present in .gitignore
let ignore_dirs: string[] = [".git", ".gitignore", "README.md", "scripts"];
// Global data object
let dataObj: data = { rootPath: getFileInitData("rootPath", rootPath) };

// Function to get all ignored folders and files present in .gitignore
function parseGitignore(): string[] {
  // Execute the git command and get its output
  const stdout: string = execSync(ignore_cmd).toString();
  // Get the list of entries to be ignored by splitting the string
  // with newline and ignore last entry since it would be empty
  ignore_dirs.push(...stdout.split("\n").slice(0, -1));
  // Convert the relative paths to absolute paths
  ignore_dirs = ignore_dirs.map((folder) => path.join(rootPath, folder));
  return ignore_dirs;
}

// Function to check if entry must be ignored
function ignoreDirent(entry: string): boolean {
  // Check if entry exists in list of paths to be ignored
  // path.relative returns empty string if paths are equal
  return ignore_dirs.findIndex((ignore) => path.relative(ignore, entry) === "") !== -1;
}

// Function to get path relative to root folder
function relPath(dir: string): string {
  // Replace \\ with / for consistency (for Windows paths)
  return "/" + path.relative(rootPath, dir).replaceAll("\\", "/");
}

// Function to get initial object to store file data
function getFileInitData(name: string, entryPath: string): fileData {
  // Replace \\ with / for consistency (for Windows paths)
  entryPath = entryPath.replaceAll("\\", "/");
  return {
    name,
    path: entryPath,
    size: 0,
    type: path.extname(name),
    totalLazyLoaded: [],
    canBeLazyLoaded: [],
    parentFolder: relPath(path.dirname(entryPath)),
  }
}

// Function to get initial object to store folder data
function getFolderInitData(name: string, entryPath: string): folderData {
  // Replace \\ with / for consistency (for Windows paths)
  entryPath = entryPath.replaceAll("\\", "/");
  return {
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

// Function to find data of a file
function addFile(filePath: string): fileData {
  // Get initial data for a file
  let fileData: fileData = getFileInitData(path.basename(filePath), filePath);
  // Get a list of components
  const components: string[] = getComponents(filePath), folderPath = path.dirname(filePath);
  // Find the size of the file
  fileData.size = fs.statSync(filePath).size;

  // If there are no components, return the file data
  if(components.length === 0) return fileData;

  // Get information about imports present in the file
  const {lazyImps, imports} = getImports(filePath);

  // Loop over the components
  for(const comp of components) {
    let toBeLazyLoaded: boolean = false;

    // Loop over the import statements
    for(const imp of imports) {

      if(!imp)
        continue;

      // If the component is being imported as a default
      // or namespace import it can be lazy loaded
      if(comp === imp.defaultImp || comp === imp.namespaceImp)
        toBeLazyLoaded = true;

      for(const namedImp of imp.namedImps || []) {
        // If component matches a named import, it can be lazy loaded
        if((namedImp.alias !== undefined && namedImp.alias === comp) ||
        (namedImp.alias === undefined && namedImp.namedImp === comp)) {
          toBeLazyLoaded = true;
          break;
        }
      }

      // Component found in an import statement
      if(toBeLazyLoaded) {
        // Find path of the component relative to root path
        const relImpPath: string = relPath(path.resolve(folderPath, imp.module));
        // Add this component to the list of all components that can be lazy loaded
        fileData.canBeLazyLoaded.push({name: comp, path: relImpPath});
        break;
      }
    }

    // If component is not already lazy loaded, continue
    if(toBeLazyLoaded) continue;

    // Loop over all dynamic / lazy imports
    for(const lazyImp of lazyImps) {
      // Check if component is being imported
      if(comp === lazyImp.lazyImp) {
        // Find path of the component relative to root path
        const relImpPath = relPath(path.resolve(folderPath, lazyImp.module));
        // Add this component to the list of all components that have been lazy loaded
        fileData.totalLazyLoaded.push({name: comp, path: relImpPath});
        break;
      }
    }
  }
  return fileData;
}

// Function to recursively traverse a directory
function walk(dir: string): folderData {
  // Get initial data for a folder
  let dirData: folderData = getFolderInitData(path.basename(dir), dir);

  // Get all directory entries present in the folder
  const entries: fs.Dirent[] = fs.readdirSync(dir, { withFileTypes: true });

  entries.forEach(function (dirent: fs.Dirent): void {
    // Get name of directory entry
    const entry: string = dirent.name;
    // Construct path of this entry
    const entryPath: string = path.join(dir, entry);

    // If entry is present in list of entries
    // to be ignored, don't process it further
    if (ignoreDirent(entryPath)) return;

    // Entry is a folder
    if (dirent.isDirectory()) {
      // Recursively traverse this folder
      const recData: folderData = walk(entryPath);

      // Add the properties of subfolders to current folder's data
      const properties: string[] = ["size", "noOfSubFolders", "noOfSubFiles", "totalLazyLoaded", "canBeLazyLoaded"];
      for(const property of properties)
        dirData[property] += recData[property];

      // Increment the count of sub-folders
      dirData.noOfSubFolders++;
      // Add the relative path of sub-folder to current folder
      dirData.foldersInside.push(relPath(entryPath));
    }
    // Entry is a file
    else if (dirent.isFile()) {
      // Get data of the file
      const recData = addFile(entryPath);
      // Add this data to the global data
      dataObj[relPath(entryPath)] = recData;

      // Add the properties of subfolders to current folder's data
      dirData.size += recData.size;
      dirData.noOfSubFiles++;
      dirData.totalLazyLoaded += recData.totalLazyLoaded.length;
      dirData.canBeLazyLoaded += recData.canBeLazyLoaded.length;
      dirData.filesInside.push(relPath(entryPath));
    }
  });

  // Add data of current folder to the global data
  dataObj[relPath(dir)] = dirData;
  return dirData;
}

function main(): void {
  parseGitignore();
  // Start traversing from root path
  walk(rootPath);
  // Link root folder to itself
  dataObj["/"].parentFolder = "/";
  // Write the data into output file
  fs.writeFile(writePath, JSON.stringify(dataObj, undefined, 2), e => e ? console.log(e) : "");
}

main();