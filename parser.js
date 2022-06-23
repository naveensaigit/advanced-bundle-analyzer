// Requiring fs module in which readFile function is defined.
const fs = require("fs");

let filePath = "";

process.argv.forEach(function (val, index, array) {
  if (index === 2) filePath = val;
});

function removeComments(data) {
  let regex =/\/\/.*/g;
  data = data.replace(regex, "");
  regex = /\/\*(\s|.|\r\n)*?\*\//gm;
  data = data.replace(regex, "");

  return data;
}

var components = [];

function getComponents(data) {
  data = removeComments(data);

  let matches = data.match(/<Route\s((\s|.|\r\n)*?)?(<\/|\/>)/gm);

  for (let match of matches) {
    if (!/component/.test(match) && !/element/.test(match)) {
      let comp = match.match(/>((\s|.|\r\n)*?)?\/>/gm);
      if (!comp) continue;
      comp = comp[0].match(/<((\s|.|\r\n)*?)?\/>/gm);
      if (!comp) continue;
      comp = comp[0].match(/\w(.)*/gm);
      if (!comp) continue;
      comp = comp[0].match(/(.)*\w/gm);
      if (!comp) continue;

      components.push(comp[0].toString());
      continue;
    }

    let comp = match.match(/component((\s|.|\r\n)*?)?}/gm);

    if (comp) {
      comp = comp[0].match(/{((\s|.|\r\n)*)/gm);
      if (!comp) continue;
      comp = comp[0].match(/\w(.)*/gm);
      if (!comp) continue;
      comp = comp[0].match(/(.)*\w/gm);
      if (!comp) continue;
      components.push(comp[0].toString());
    } else {
      comp = match.match(/element((\s|.|\r\n)*)/gm);
      if (!comp) continue;
      comp = comp[0].match(/{((\s|.|\r\n)*)/gm);
      if (!comp) continue;
      comp = comp[0].match(/\w(.)*/gm);
      if (!comp) continue;
      comp = comp[0].match(/(.)*\w/gm);
      if (!comp) continue;
      components.push(comp[0].toString());
    }
  }
}
fs.readFile(filePath, (err, e) => {
  if (err) throw err;

  let data = e.toString();
  getComponents(data);
  console.log(components);
});
