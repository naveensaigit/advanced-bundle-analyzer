export function removeComments(data) {
  let regex = /\/\/.*/g;
  data = data.replace(regex, "");
  regex = /\/\*(\s|.|\r\n)*?\*\//gm;
  data = data.replace(regex, "");

  return data;
}

export function removeFileImports(text) {
  let reg = /import((\r\n|\s)*?)?('|")(.*)('|");/gm;
  return text.replace(reg, "");
}

export function getImports(text) {
  let imports = [];
  text = removeComments(text);
  text = removeFileImports(text);

  let reg = new RegExp("import((.|\r\n|\\s)*?)?from((.|\r\n|\\s)*?)?;", "gm"),
    match;

  do {
    match = reg.exec(text);
    if (match) {
      let module = match[3].match(/('|")(.*)('|")/gm)[0];
      let stmt = match[0];

      let namedExps = new RegExp("{((.|\r\n|\\s)*?)}", "gm");
      namedExps = namedExps.exec(stmt);
      if (namedExps) {
        namedExps = namedExps[1].split(",");
        namedExps = namedExps.map((e) => {
          e = e.replaceAll("\n", "").split(" ");
          let alias = "",
            namedExp = "";
          for (let i of e) {
            if (i != "" && i != "as") {
              if (alias == "") alias = i;
              else namedExp = i;
            }
          }
          if (namedExp == "") return { namedExp: alias };
          return { alias, namedExp };
        });
      }

      let defaultExp = new RegExp(
        "(import|,)((\r\n|\\s)*?)?(\\w*)((\r\n|\\s)*?)?(,|from)",
        "gm"
      );
      defaultExp = defaultExp.exec(stmt);
      if (defaultExp) defaultExp = defaultExp[4].trim().replaceAll("\n", "");

      let namespaceExp = new RegExp(
        "\\*((.|\r\n|\\s)*?)?as((.|\r\n|\\s)*?)?((.|\r\n|\\s)*?)(,|from)",
        "gm"
      );
      namespaceExp = namespaceExp.exec(stmt);
      if (namespaceExp)
        namespaceExp = namespaceExp[5].trim().replaceAll("\n", "");

      imports.push({
        import: stmt,
        defaultExp,
        namedExps: JSON.stringify(namedExps),
        namespaceExp,
        module,
      });
    }
  } while (match);

  return imports;
}
