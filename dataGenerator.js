import fs from "fs";
import { getInfoFolder } from "./parseDirent.js";

let path = process.argv[2];

let output = getInfoFolder(path);
fs.writeFile("scripts/data.json", output, (err) => {
  if (err) {
    console.error(err);
    return;
  }
});
