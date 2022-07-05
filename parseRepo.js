import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { getComponents } from "./parseRoutes.js";
import { getImports } from "./parseImports.js";

// Path of root folder
const rootPath = path.resolve(process.argv[2]), writePath = process.argv[3] || "data.json";
// Git command to get all ignored folders and files present in .gitignore
const ignore_cmd = "git ls-files -o -i --exclude-standard --directory";
// Some folders and files which may not be present in .gitignore
let ignore_dirs = [".git", ".gitignore", "README.md", "scripts"], data = { rootPath };

// Function to get all ignored folders and files present in .gitignore
function parseGitignore() {
  // Execute the git command and get its output
  const stdout = execSync(ignore_cmd).toString();
  // Get the list of entries to be ignored by splitting the string
  // with newline and ignore last entry since it would be empty
  ignore_dirs.push(...stdout.split("\n").slice(0, -1));
  // Convert the relative paths to absolute paths
  ignore_dirs = ignore_dirs.map((folder) => path.join(rootPath, folder));
  return ignore_dirs;
}

// Function to check if entry must be ignored
function ignoreDirent(entry) {
  // Check if entry exists in list of paths to be ignored
  // path.relative returns empty string if paths are equal
  return ignore_dirs.findIndex((ignore) => path.relative(ignore, entry) === "") !== -1;
}

// Function to get path relative to root folder
function relPath(dir) {
  // Replace \\ with / for consistency (for Windows paths)
  return "/" + path.relative(rootPath, dir).replaceAll("\\", "/");
}

// Function to get initial object to store data
function getInitData(name, entryPath, isFile = true) {
  // Replace \\ with / for consistency (for Windows paths)
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

// Function to find data of a file
function addFile(filePath) {
  // Get initial data for a file
  let fileData = getInitData(path.basename(filePath), filePath);
  // Get a list of components
  let components = getComponents(filePath), folderPath = path.dirname(filePath);
  // Find the size of the file
  fileData.size = fs.statSync(filePath).size;

  // If there are no components, return the file data
  if(components.length === 0) return fileData;

  // Get information about imports present in the file
  let {lazyImps, imports} = getImports(filePath);

  // Loop over the components
  for(let comp of components) {
    let toBeLazyLoaded = false;

    // Loop over the import statements
    for(let imp of imports) {

      // If the component is being imported as a default
      // or namespace import it can be lazy loaded
      if(comp === imp.defaultImp || comp === imp.namespaceImp)
        toBeLazyLoaded = true;

      for(let namedImp of imp.namedImps || []) {
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
        let relImpPath = relPath(path.resolve(folderPath, imp.module));
        // Add this component to the list of all components that can be lazy loaded
        fileData.canBeLazyLoaded.push({name: comp, path: relImpPath});
        break;
      }
    }

    // If component is not already lazy loaded, continue
    if(toBeLazyLoaded) continue;

    // Loop over all dynamic / lazy imports
    for(let lazyImp of lazyImps) {
      // Check if component is being imported
      if(comp === lazyImp.lazyImp) {
        // Find path of the component relative to root path
        let relImpPath = relPath(path.resolve(folderPath, lazyImp.module));
        // Add this component to the list of all components that have been lazy loaded
        fileData.totalLazyLoaded.push({name: comp, path: relImpPath});
        break;
      }
    }
  }
  return fileData;
}

// Function to recursively traverse a directory
function walk(dir) {
  // Get initial data for a folder
  let dirData = getInitData(path.basename(dir), dir, false);

  // Get all directory entries present in the folder
  let entries = fs.readdirSync(dir, { withFileTypes: true });

  entries.forEach(function (dirent) {
    // Get name of directory entry
    let entry = dirent.name;
    // Construct path of this entry
    const entryPath = path.join(dir, entry);

    // If entry is present in list of entries 
    // to be ignored, don't process it further
    if (ignoreDirent(entryPath)) return;

    // Entry is a folder
    if (dirent.isDirectory()) {
      // Recursively traverse this folder
      let recData = walk(entryPath);

      // Add the properties of subfolders to current folder's data
      let properties = ["size", "noOfSubFolders", "noOfSubFiles", "totalLazyLoaded", "canBeLazyLoaded"];
      for(let property of properties)
        dirData[property] += recData[property];

      // Increment the count of sub-folders
      dirData.noOfSubFolders++;
      // Add the relative path of sub-folder to current folder
      dirData.foldersInside.push(relPath(entryPath));
    }
    // Entry is a file
    else if (dirent.isFile()) {
      // Get data of the file
      let recData = addFile(entryPath);
      // Add this data to the global data
      data[relPath(entryPath)] = recData;

      // Add the properties of subfolders to current folder's data
      dirData.size += recData.size;
      dirData.noOfSubFiles++;
      dirData.totalLazyLoaded += recData.totalLazyLoaded.length;
      dirData.canBeLazyLoaded += recData.canBeLazyLoaded.length;
      dirData.filesInside.push(relPath(entryPath));
    }
  });
  
  // Add data of current folder to the global data
  data[relPath(dir)] = dirData;
  return dirData;
}

function main() {
  parseGitignore();
  // Start traversing from root path
  walk(rootPath);
  // Link root folder to itself
  data["/"].parentFolder = "/";
  // Write the data into output file
  fs.writeFile(writePath, JSON.stringify(data, undefined, 2), e => e ? console.log(e) : "");
}

main();