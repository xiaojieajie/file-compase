#!/usr/bin/env node

const type = "666";

function print(msg) {
  process.stdout.write(msg + '\n')
}

function runoo() {
  process.stdout.write(type + '\n');
};

if (process.argv.includes('-h')) {
  print(process.argv)
  print(`help ooo`)
}

runoo();
