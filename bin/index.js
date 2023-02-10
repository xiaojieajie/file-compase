#!/usr/bin/env node
const startCompress = require('../src/index');

if (process.argv.length < 3) {
  console.log('请输入图片路径');
  process.exit();
}

startCompress(process.argv[2]);
