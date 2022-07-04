import { getComponents } from "./parseRoutes.js";
import { getImports } from "./parseImports.js";
import fs from "fs";

let components = [];
let imports = [];

function getLazyLoaded(alreadyLazyLoaded, canBeLazyLoaded) {
  for (let component of components) {
    for (let importLine of imports) {
      if (component === importLine.defaultExp) {
        canBeLazyLoaded.push({ name: component, module: importLine.module });
        break;
      }
      if (component === importLine.lazyExp) {
        alreadyLazyLoaded.push({ name: component, module: importLine.module });
        break;
      }
    }
  }
}

function modify(loaded, filePath) {
  loaded = loaded.map((component) => {
    let parentFolder = "";
    if (component.module[1] === ".") {
      parentFolder = `"${filePath.substr(0, filePath.lastIndexOf("/"))}`;
      component.module = component.module.substr(2, component.module.length);
    }

    return `
      {
        "name": "${component.name}",
        "path": ${parentFolder}${component.module}
      }`;
  });

  loaded = loaded.join(",");

  if (loaded.length) loaded += "\r\n    ";

  return loaded;
}

export function parseFile(filePath) {
  const data = fs.readFileSync(filePath, "utf8");

  let code = data.toString();
  components = getComponents(code);
  imports = [];

  if (components.length) imports = getImports(code);

  let canBeLazyLoaded = [];
  let alreadyLazyLoaded = [];
  getLazyLoaded(alreadyLazyLoaded, canBeLazyLoaded);

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
