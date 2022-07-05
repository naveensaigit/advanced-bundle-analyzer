import { exec } from "child_process";

exec("git ls-files --o --i --exclude-standard --directory", function (error, stdout, stderr) {
  let ignore_dirs = stdout.split("\n");
  console.log(ignore_dirs);

  console.log("stdout: " + stdout);
  console.log("stderr: " + stderr);
  if (error !== null) {
    console.log("exec error: " + error);
  }

  return ignore_dirs;
});
