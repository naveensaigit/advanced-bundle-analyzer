import { writeFile } from "./Writer.js";
import { getInfoFolder } from "./getInfoFolder.js";

let path = process.argv[2];

let output = getInfoFolder(path);
writeFile("scripts/data.json", output);
