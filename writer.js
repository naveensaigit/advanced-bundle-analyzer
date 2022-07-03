import fs from "fs";

export function writeFile(writePath, data) {
  fs.writeFile(writePath, data, (err) => {
    if (err) {
      console.error(err);
      return;
    }
  });
}
