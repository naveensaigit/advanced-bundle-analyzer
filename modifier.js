// Automatically add dynamic imports for components that can be lazy loaded

import fs from "fs";
import {getImports, objToImport, isPresent, removeComp, getLazyCode} from './parseImports.js';
import {getComponents} from './parseRoutes.js';

// Path of file to read and write the modified code
let readPath = process.argv[2], writePath = process.argv[3];

// Convert "namedExp as alias" => {alias: "alias", namedExp: "namedExp"}
export function stringToNamedExps(imp) {
  // Trim the string and replace multiple spaces with single space
  imp = imp.trim().replace(/\s\s+/g, ' ').split(" ");
  return imp.length == 1 ? {namedExp: imp[0]} : {namedExp: imp[0], alias: imp[2]};
}

// Construct import syntax for named exports
export function namedExpsToString(namedExps) {
  // Convert {alias: "alias", namedExp: "namedExp"} => "namedExp as alias"
  namedExps = namedExps.map(named =>
    `${named.namedExp}${named.alias != undefined ? " as " + named.alias : ""}`
  );

  // Join all named exports and enclose them in { ... }
  return `{${namedExps.join(", ")}}`;
}

// Convert import object to a string
export function objToImport(obj) {
  let exports = [];

  // If default export is present, add it to the statement
  if(obj.defaultExp != null)
    exports.push(obj.defaultExp);

  // If namespace export is present, add it to the statement
  if(obj.namespaceExp != null)
    exports.push("* as " + obj.namespaceExp);

  // If named exports are present, add them to the statement
  if(obj.namedExps != null)
    exports.push(namedExpsToString(obj.namedExps));

  // No exports are present, import statement would be empty
  if(exports.length == 0)
    return "";

  // Return the final import statement
  return `import ${exports.join(", ")} from ${obj.module};`;
}

// Check if component is being imported from import
export function isPresent(comp, imp) {
  // Check if component matches default export
  if(comp == imp.defaultExp)
    return ['default'];

  // Check if component matches any of the named export
  else if(imp.namedExps != null)
    // Iterate through all named exports
    for(let named of imp.namedExps) {
      if(named.alias != null) {
        if(comp == named.alias)
          return ['alias', named];
      }
      else if(comp == named.namedExp)
        return ['namedExp', named];
    }
  return false;
}

// Remove component from import object
export function removeComp(comp, impType, imp) {
  // If component is a default export
  if(impType[0] == 'default')
    imp.defaultExp = null;
  // Component is a named export
  else {
    // Get all named exports without component
    imp.namedExps = imp.namedExps.filter(e => e[impType[0]] != comp);
    // If there are no exports left, set it to null
    if(imp.namedExps.length == 0)
      imp.namedExps = null;
  }
  return imp;
}

// Get code for lazily importing a component
export function getLazyCode(comp, impType, path) {
  // Lazy import code changes according to type of export
  switch(impType[0]) {
    // Component is a default export
    case 'default':
      return `const ${comp} = ReactLazyAliased(() => import(${path}));\n`;

    // Component is a named export (without an alias)
    case 'namedExp':
      return `const ${comp} = ReactLazyAliased(async () => {
        const resolved = await import(${path});
        return {default: resolved["${comp}"]};
      });\n`;

    // Component is a named export (with an alias)
    case 'alias':
      return `const ${comp} = ReactLazyAliased(async () => {
        const resolved = await import(${path});
        return {default: resolved["${impType[1].namedExp}"]};
      });\n`;

    default: "";
  }
}

// Wrap all router tags with Suspense tag
function addSuspense(code) {
  let match, newCode = code;

  // Regex to match spaces and newlines
  let spaces = "((\r\n|\\s)*?)?";

  // Find all opening Router tags
  // Different Router tags are - BrowserRouter, HashRouter, etc.
  let start = new RegExp(`<${spaces}(Browser|Hash|History|Memory|Native|Static)?Router${spaces}>`, "gm");
  do {
    // Search for opening Router tag
    match = start.exec(code);
    // If match is found
    if(match)
      // Add an opening Suspense tag
      newCode = newCode.replace(match[0], "<ReactSuspenseAliased fallback={<></>}>\n" + match[0])
  } while (match);

  // Find all closing Router tags
  let end = new RegExp(`<${spaces}\/${spaces}(Browser|Hash|History|Memory|Native|Static)?Router${spaces}>`, "gm");
  do {
    // Search for closing Router tag
    match = end.exec(code);
    // If match is found
    if(match)
      // Add a closing Suspense tag
      newCode = newCode.replace(match[0], match[0] + "\n</ReactSuspenseAliased>\n")
  } while (match);

  return newCode;
}

function modifyCode(code, comps, imports) {
  // Import Suspense and lazy fom React
  let lazyCode = "\nimport {Suspense as ReactSuspenseAliased, lazy as ReactLazyAliased} from 'react';\n\n";

  // Iterate through all components that can be lazy loaded
  for(let comp of comps) {

    for(let index = 0; index < imports.length; index++) {
      // Check if component is being imported in this statement
      let impType = isPresent(comp, imports[index]);

      if(impType) {
        // Create a new import object removing this component
        let newObj = removeComp(comp, impType, imports[index]);
        // Construct a corresponding import statement
        let newImp = objToImport(newObj);
        // Replace the old import statement with the new one
        code = code.replace(imports[index].import, newImp);
        // Update this in the object too
        imports[index].import = newImp;
        // Add lazy import code for this component
        lazyCode += getLazyCode(comp, impType, imports[index].module);
        // Break from the loop
        index = imports.length;
      }
    }
  }

  // Add the lazy import code after all high level import statements end
  code = code.replace(imports[imports.length-1].import, `${imports[imports.length-1].import}${lazyCode}`);

  // Add code to import Suspense and lazy
  code = addSuspense(code);

  // Write the modified code to the destination file
  fs.writeFile(writePath, code, (err) => {
    if (err) console.error(err);
  });
}

// Read the input file
fs.readFile(readPath, (err, e) => {
  if (err) throw err;

  // Read the code present in the file
  let code = e.toString();

  // Find components that can be lazy loaded
  let comps = getComponents(code);

  // Parse all import statements in the file
  let imports = getImports(code);

  modifyCode(code, comps, imports);
});