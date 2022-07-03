import { getComponents } from "./parseRoutes.js";
import { getImports } from "./parseImports.js";
import fs from "fs";

let components = [];
let imports = [];

function getLazyLoaded(alreadyLazyLoaded, canBeLazyLoaded) {
  for (let component of components) {
    let done = false;

    for (let importLine of imports) {
      if (component === importLine.defaultExp) {
        canBeLazyLoaded.push({"name": component, "module": importLine.module});
        done = true;
        break;
      }
    }

    if (!done) alreadyLazyLoaded.push({"name": component, "module": '"!"'});
  }
}

function modify(loaded) {
  loaded = loaded.map((component) => {
    return `
      {
        "name": "${component.name}",
        "path": ${component.module}
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

  if (components.length) imports = getImports(code);

  let canBeLazyLoaded = [];
  let alreadyLazyLoaded = [];
  getLazyLoaded(alreadyLazyLoaded, canBeLazyLoaded);

  let noOfCanBeLazyLoaded = canBeLazyLoaded.length;
  let noOfAlreadyLazyLoaded = alreadyLazyLoaded.length;

  alreadyLazyLoaded = modify(alreadyLazyLoaded);
  canBeLazyLoaded = modify(canBeLazyLoaded);

  return {
    canBeLazyLoaded,
    noOfCanBeLazyLoaded,
    alreadyLazyLoaded,
    noOfAlreadyLazyLoaded,
  };
}
