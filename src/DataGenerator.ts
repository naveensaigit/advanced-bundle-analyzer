import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import { execSync } from "child_process";
import { getImports, jsxReturningFunctions, defaultExpMemo } from "./parseImports.js";
import { returnGetImports } from './parseImports';
import cliProgress from 'cli-progress';

// Path of this file
const __filename = fileURLToPath(import.meta.url);
// Path of the directory containing this file
// __dirname isn't defined for modules
const __dirname = path.dirname(__filename);

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

// Type of render tree
type renderTreeType = {
  [key: string]: componentInfo
};

// Each key in canBeLazy has two properties :
// path -> path from which the component is exported.
// exportName -> name of component where its is defined.
type importStatements = {
  path: string,
  exportName: string | null
}

type canBeLazy = {
  [key: string]: importStatements     //  key is the importName used for importing a component in a file.
}

// Information stored for a file.
type fileData = {
  name: string,
  path: string,
  size: number,
  type: string,
  alreadyLazyLoaded: number,
  canBeLazyLoaded: canBeLazy,
  canNotBeLazyLoaded: number
}

type outputObject = {
  [key: string]: fileData
}

// A memo for jsx returning functions for a filepath.
let jsxReturnTypeFunctions: jsxReturningFunctions = {};

// A memo for default exports for a filepath.
let defaultExportsMemo: defaultExpMemo = {};

// These are the file types which are being considered
// empty extension is used to match for the files whose 
// extension is already given in the import statement path.
let extensions: string[] = ['', '.js', '.jsx', '.ts', '.tsx'];

// Object that will hold the information about files only that are shown on UI
let dataObject: outputObject = {};

// Path of root folder
const readPath: string = path.resolve(process.argv[2]);
const writePath: string = process.argv[3] || "data.json";
const rootPath: string = path.resolve();

// Flag for filtering unwanted suggestions
const filterSuggestions = (process.env.FILTER === "true") || false;
let renderTree: renderTreeType = JSON.parse(fs.readFileSync(readPath).toString());

// Function to get initial object to store file data.
function getFileInitData(name: string, entryPath: string): fileData {
  // Replace \\ with / for consistency (for Windows paths).
  entryPath = entryPath.replaceAll("\\", "/");
  return {
    name,
    path: entryPath,
    size: 0,
    type: path.extname(name),
    alreadyLazyLoaded: 0,
    canBeLazyLoaded: {},
    canNotBeLazyLoaded: 0
  }
}

// Type of components whose lazy loading suggestion should not be shown on UI. 
type dontLazyLoad = {
  path: string,
  exportName: string | null
}

let notToBeLazyLoaded: { [key: string]: dontLazyLoad } = {};    // Key is a unique combination of path & exportName.

// visited object is maintained to mark the nodes of render tree as visited. 
let visited: { [key: string]: boolean } = {};     // Key is a unique combination of name of component & the path of source file in which it is rendered

// create a new progress bar instance and use shades_classic theme
console.log("Processing Render Tree :");
// bar1 shows the progress while iterating over nodes of render tree.
const bar1 = new cliProgress.SingleBar({format:'{bar} {percentage}% | ETA: {eta}s | {value}/{total}'}, cliProgress.Presets.shades_classic);

// start the progress bar with a total value equal to number of keys in render Tree  and start value of 0.
bar1.start(Object.keys(renderTree).length, 0);
let currentPosition = 0;

for (let node in renderTree) {
  // update the current value in bar.
  bar1.update(++currentPosition);
  if (renderTree[node].hasOwnProperty('source') === false)    // Current node in render tree is skipped, if does not contain source field.
    continue;

  // Export name and filepath is a unique combination for
  // all components analyzed as part of the render tree
  let identifier_key: string = renderTree[node].name + ":" + renderTree[node].source.fileName;

  // If same component has already been processed
  if (visited[identifier_key])
    continue;

  // Mark component as processed in memo
  visited[identifier_key] = true;

  let filePath: string = renderTree[node].source.fileName;

  filePath = filePath.replaceAll('\\', '/');

  // check this file is in memo or not

  if (dataObject.hasOwnProperty(filePath) === false) {
    // If we don't have any Information regarding the current files imports in dataObject we need to run parse imports once for the current file.

    let fileData: fileData = getFileInitData(path.basename(filePath), filePath);
    fileData.size = fs.statSync(filePath).size;     // computing size of current file.
    let { lazyImps, imports, ...memos }: returnGetImports = getImports(filePath, filterSuggestions, defaultExportsMemo, jsxReturnTypeFunctions);

    // Update the memos for the next run
    defaultExportsMemo = memos.defaultExportsMemo;
    jsxReturnTypeFunctions = memos.jsxReturnTypeFunctions;

    for (let imp of imports) {
      if (!imp || !imp.module)
        continue;

      // Absolute path of file from which the current imported component is exported.
      let importModulePath: string = path.resolve(path.dirname(filePath), imp.module);

      importModulePath = importModulePath.replaceAll('\\', '/');

      // Initially all the components from default, namespace & named imports are considered as can be lazy loaded.

      // If the component is being imported as a default import.
      if (imp.defaultImp !== null && imp.defaultImp.importedAs !== null) {
        fileData.canBeLazyLoaded[imp.defaultImp.importedAs] =
        {
          path: importModulePath,
          exportName: imp.defaultImp.exportedAs
        };
      }

      // Getting components from named import
      for (let namedImp of imp.namedImps || []) {
        if (namedImp.namedImp) {
          fileData.canBeLazyLoaded[namedImp.namedImp] = {
            path: importModulePath,
            exportName: namedImp.namedImp
          }
        }
      }
    }

    // Loop over all dynamic / lazy imports.
    for (let lazyImp of lazyImps) {
      if (lazyImp.lazyImp) {

        let importModulePath: string = path.resolve(path.dirname(filePath), lazyImp.module);

        // Finding the extension for importModulePath file.
        for (let extension of extensions) {
          if (fs.existsSync(importModulePath + extension)) {
            importModulePath += extension;
            break;
          }
        }

        if (!fs.existsSync(importModulePath))   // If the file is not present in the path mentioned in the import statement, it is imported from node modules.
          continue;
          
        fileData.alreadyLazyLoaded++;
      }
    }

    dataObject[filePath] = fileData;
  }

  // Getting name from component rendering statement.
  let code: string = fs.readFileSync(filePath, "utf8");

  const lineNumber: number = renderTree[node].source.lineNumber;
  let ColumnNumber: number = 1; // Default column number is considered to be start of line. Used when column number is not defined for a render tree node.

  let numberOfCharacters: number = 0;   // For finding number of characters present in file before the render statement.
  let line: number = 1, col: number = 1;
  let ch = '\n';

  if (renderTree[node].source.columnNumber) {
    ColumnNumber = renderTree[node].source.columnNumber;
    ch = '>';
  }

  while (line !== lineNumber || col !== ColumnNumber) {
    col++;

    if (code[numberOfCharacters] === '\n') {
      line++;
      col = 1;
    }

    numberOfCharacters++;
  }

  // Remove the code present before the render statement of the current component.
  code = code.substring(numberOfCharacters + 1, code.length);

  // Get the render statement by removing excess code after '>' or '\n'.
  let renderStatement: string = code.substring(0, code.indexOf(ch));

  // Get all the keywords/words present in the render statement of the current component.
  const keywords: string[] = renderStatement.split(/[^a-zA-Z0-9_$]+/gm);

  // Loop over all the imports that can still be lazy loaded for the current file & match those with the current component.
  for (let imp in dataObject[filePath].canBeLazyLoaded) {
    let found: boolean = false;

    let importDetails: importStatements = dataObject[filePath].canBeLazyLoaded[imp];

    for (let word of keywords) {
      if (imp === word && importDetails.exportName === renderTree[node].name) {
        found = true;

        //If the current child component is rendered we remove it from can be lazy loaded for the current file (in which the parent component resides).
        dataObject[filePath].canNotBeLazyLoaded++;
        
        delete dataObject[filePath].canBeLazyLoaded[imp];

        let key: string = importDetails.path + ':' + importDetails.exportName;

        // Add information about this component in notToBeLazyLoaded object if not done already.
        if (notToBeLazyLoaded.hasOwnProperty(key))
          continue;

        notToBeLazyLoaded[key] =
        {
          path: importDetails.path,
          exportName: importDetails.exportName
        }
      }
    }

    if (found) {
      // If the current component has already matched one of the imports, we don't need to match it with any other components.
      break;
    }
  }

  // Loop over all the components that cant be lazy loaded
  for (let imp in notToBeLazyLoaded) {
    // loop over all the file values in dataObject

    for (let file in dataObject) {
      // For the current file, remove the current component if it's in canBeLazyLoaded array

      for (let canLazyLoad in dataObject[file].canBeLazyLoaded) {
        let importDetails: importStatements = dataObject[file].canBeLazyLoaded[canLazyLoad];

        if (importDetails.path === notToBeLazyLoaded[imp].path && importDetails.exportName === notToBeLazyLoaded[imp].exportName) {
          delete dataObject[file].canBeLazyLoaded[canLazyLoad];
          dataObject[file].canNotBeLazyLoaded++;
          break;
        }
      }
    }
  }
}

// Delete the temporary tsx file used to get the jsx returning functions for a file. 
if(fs.existsSync(path.resolve(__dirname, "temp.tsx")))
    fs.unlinkSync(path.resolve(__dirname, "temp.tsx"));

// stop the progress bar
bar1.stop();
console.log();

/*END OF ANALYZING RENDER TREE*/

/*BEGINNING OF GENERATION OF DATA*/

// Now we have the dataObject & Using this we need to form Data.json file.

// Information stored for a folder in completeDataObject
type completeFolderData = {
  name: string,
  path: string,
  size: number,
  noOfSubFolders: number,
  noOfSubFiles: number,
  alreadyLazyLoaded: number,
  canBeLazyLoaded: number,
  canNotBeLazyLoaded: number,
  foldersInside: string[],
  filesInside: string[],
  parentFolder: string,
  [key: string]: any
}

// Information stored for a file in completeDataObject
type completeFileData = {
  name: string,
  path: string,
  size: number,
  type: string,
  alreadyLazyLoaded: number,
  canBeLazyLoaded: canBeLazy,
  canNotBeLazyLoaded: number,
  parentFolder: string,
  [key: string]: any
}

// Type for global data object
// "entry" - fileData or folderData
type data = {
  [key: string]: completeFileData | completeFolderData
}

// Git command to get all ignored folders and files present in .gitignore
const ignore_cmd: string = "git ls-files -o -i --exclude-standard --directory";
// Some folders and files which may not be present in .gitignore
let ignore_dirs: string[] = [".git", ".gitignore", "README.md", "scripts"];
// Global data object
let completeDataObject: data = { rootPath: getFileData("rootPath", rootPath) };

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
function getFileData(name: string, entryPath: string): completeFileData {
  // Replace \\ with / for consistency (for Windows paths)
  entryPath = entryPath.replaceAll("\\", "/");
  return {
    name,
    path: entryPath,
    size: 0,
    type: path.extname(name),
    alreadyLazyLoaded: 0,
    canBeLazyLoaded: {},
    canNotBeLazyLoaded: 0,
    parentFolder: relPath(path.dirname(entryPath)),
  }
}

// Function to get initial object to store folder data
function getFolderData(name: string, entryPath: string): completeFolderData {
  // Replace \\ with / for consistency (for Windows paths)
  entryPath = entryPath.replaceAll("\\", "/");
  return {
    name,
    path: entryPath,
    size: 0,
    noOfSubFolders: 0,
    noOfSubFiles: 0,
    alreadyLazyLoaded: 0,
    canBeLazyLoaded: 0,
    canNotBeLazyLoaded: 0,
    foldersInside: [],
    filesInside: [],
    parentFolder: relPath(path.dirname(entryPath)),
  };
}

// Function to find data of a file
function addFile(filePath: string): completeFileData {
  // Get initial data for a file
  let fileData: completeFileData = getFileData(path.basename(filePath), filePath);
  let key: string = filePath.replaceAll("\\", "/");

  // All the file details needed are already present in the dataObject

  fileData.size = dataObject[key].size;
  fileData.canBeLazyLoaded = dataObject[key].canBeLazyLoaded;
  fileData.canNotBeLazyLoaded = dataObject[key].canNotBeLazyLoaded;
  fileData.alreadyLazyLoaded = dataObject[key].alreadyLazyLoaded;

  return fileData;
}

// create a new progress bar instance and use shades_classic theme
console.log("Processing data :");
// bar2 is used to show the progress of data generation process
const bar2 = new cliProgress.SingleBar({format:'{bar} {percentage}% | ETA: {eta}s'}, cliProgress.Presets.shades_classic);
let total: number = 1;            // Total number of paths that need to be visited.
let current: number = 0;          // Current number of paths that are visited.
let bar2percent: number = 0;

// start the progress bar showing progress of completeDataObject
bar2.start(100, 0);

// Function to recursively traverse a directory
function walk(dir: string): completeFolderData {
  // Get initial data for a folder
  let dirData: completeFolderData = getFolderData(path.basename(dir), dir);

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
      total++;
      // Recursively traverse this folder
      const recData: completeFolderData = walk(entryPath);

      // If there are to files to suggestions for in the current directory.
      if (recData.noOfSubFiles === 0) return;

      // Add the properties of subfolders to current folder's data
      const properties: string[] = ["size", "noOfSubFolders", "noOfSubFiles", "alreadyLazyLoaded", "canBeLazyLoaded", "canNotBeLazyLoaded"];
      for (const property of properties)
        dirData[property] += recData[property];

      // Increment the count of sub-folders
      dirData.noOfSubFolders++;
      // Add the relative path of sub-folder to current folder
      dirData.foldersInside.push(relPath(entryPath));
    }
    // Entry is a file
    else if (dirent.isFile()) {

      let key: string = entryPath.replaceAll("\\", "/");

      // If a file is absent from dataObject, currently no suggestions exist for that file.
      if (dataObject.hasOwnProperty(key) === false) return;

      total++;
      // Get data of the file
      const recData = addFile(entryPath);
      // Add this data to the global data
      completeDataObject[relPath(entryPath)] = recData;
      current++;

      // Add the properties of the current file to its parent's folder data
      dirData.size += recData.size;
      dirData.noOfSubFiles++;
      dirData.alreadyLazyLoaded += recData.alreadyLazyLoaded;
      dirData.canNotBeLazyLoaded += recData.canNotBeLazyLoaded;
      dirData.canBeLazyLoaded += Object.keys(recData.canBeLazyLoaded).length;
      dirData.filesInside.push(relPath(entryPath));
    }
  });

  if (dirData.noOfSubFiles !== 0) {
    // Add data of current folder to the global data
    completeDataObject[relPath(dir)] = dirData;
  }

  current++;
  bar2percent = (bar2percent > ((current*100) / total))? bar2percent : ((current*100) / total);

  // update the current value in bar.
  bar2.update(++bar2percent);

  return dirData;
}

parseGitignore();

// Start traversing from root path
walk(rootPath);

// stop the progress bar
bar2.stop();

if (completeDataObject.hasOwnProperty("/") === false) {
  completeDataObject["/"] = getFolderData(path.basename(rootPath), rootPath);
}

// Link root folder to itself
completeDataObject["/"].parentFolder = "/";

// Modify the completeDataObject to transform it to form that is accepted by UI.

let modifiedCompleteDataObject: data = {};

for (let path in completeDataObject) {
  // Add root folders name to each path in data.
  let newPath = path;
  if (path[0] === "/") newPath = "/" + completeDataObject["/"].name + path;
  if (path === "/") newPath = "/" + completeDataObject["/"].name;

  modifiedCompleteDataObject[newPath] = completeDataObject[path];

  if (path === newPath) continue;

  // Update all the parent folder paths in data.
  if (modifiedCompleteDataObject[newPath].parentFolder === "/" && path !== "/")
    modifiedCompleteDataObject[newPath].parentFolder = "/" + completeDataObject["/"].name;
  else if (modifiedCompleteDataObject[newPath].parentFolder[0] === "/" && path !== "/")
    modifiedCompleteDataObject[newPath].parentFolder = "/" + completeDataObject["/"].name + modifiedCompleteDataObject[newPath].parentFolder;

  // Update all the folders inside paths in data.
  if (typeof modifiedCompleteDataObject[newPath].foldersInside === "object") {
    for (let index = 0; index < modifiedCompleteDataObject[newPath].foldersInside.length; index++) {
      if (modifiedCompleteDataObject[newPath].foldersInside[index][0] === "/") {
        modifiedCompleteDataObject[newPath].foldersInside[index] = "/" + completeDataObject["/"].name + modifiedCompleteDataObject[newPath].foldersInside[index];
      }
    }
  }

  // Update all the files inside paths in data.
  if (typeof modifiedCompleteDataObject[newPath].filesInside === "object") {
    for (let index = 0; index < modifiedCompleteDataObject[newPath].filesInside.length; index++) {
      if (modifiedCompleteDataObject[newPath].filesInside[index][0] === "/") {
        modifiedCompleteDataObject[newPath].filesInside[index] = "/" + completeDataObject["/"].name + modifiedCompleteDataObject[newPath].filesInside[index];
      }
    }
  }
}

// Get data for root directory.
modifiedCompleteDataObject["/"] = getFolderData(path.basename(rootPath), rootPath);

// Link root folder to itself
modifiedCompleteDataObject["/"].parentFolder = "/";
modifiedCompleteDataObject["/"].foldersInside.push("/" + completeDataObject["/"].name);
modifiedCompleteDataObject["/"].name = ":rootDirectory";

// Write the data into output file
fs.writeFile(writePath, JSON.stringify(modifiedCompleteDataObject, undefined, 2), e => e ? console.log(e) : "");