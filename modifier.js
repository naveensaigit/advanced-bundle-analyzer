import fs from "fs";
import {getImports, objToImport, isPresent, removeComp, getLazyCode} from './parseImports.js';
import {getComponents} from './parser.js';

let readPath = process.argv[2], writePath = process.argv[3];

function addSuspense(code) {
  let match, newcode = code;

  let start = new RegExp("<((\r\n|\\s)*?)?((\r\n|\\s)*?)?(Browser|Hash|History|Memory|Native|Static)?Router((\r\n|\\s)*?)?>", "gm");
  do {
    match = start.exec(code);
    if(match)
      newcode = newcode.replace(match[0], "<ReactSuspenseAliased fallback={<></>}>\n" + match[0])
  } while (match);

  let end = new RegExp("<((\r\n|\\s)*?)?\/((\r\n|\\s)*?)?(Browser|Hash|History|Memory|Native|Static)?Router((\r\n|\\s)*?)?>", "gm");
  do {
    match = end.exec(code);
    if(match)
      newcode = newcode.replace(match[0], match[0] + "\n</ReactSuspenseAliased>\n")
  } while (match);

  return newcode;
}

function modifyCode(code, comps, imports) {
  let lazyCode = "\nimport {Suspense as ReactSuspenseAliased, lazy as ReactLazyAliased} from 'react';\n\n";

  for(let comp of comps) {
    for(let index = 0; index < imports.length; index++) {
      let impType = isPresent(comp, imports[index]);

      if(impType) {
        let newobj = removeComp(comp, impType, imports[index]);
        let newImp = objToImport(newobj);
        code = code.replace(imports[index].import, newImp);
        imports[index].import = newImp;
        lazyCode += getLazyCode(comp, impType, imports[index].module);

        index = imports.length;
      }
    }
  }

  code = code.replace(imports[imports.length-1].import, `${imports[imports.length-1].import}${lazyCode}`);
  code = addSuspense(code);

  fs.writeFile(writePath, code, (err) => {
    if (err) console.error(err);
  });
}

fs.readFile(readPath, (err, e) => {
  if (err) throw err;

  let code = e.toString(), imports = getImports(code), comps = getComponents(code);
  modifyCode(code, comps, imports);
});