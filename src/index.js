const fs = require('fs').promises // 文件模块
const util = require('util')
const os = require('os')
const chalk = require('chalk') // 控制台模块
const child_process = require('child_process');
const readline = require('readline'); // node 行流
const path = require('path') 
const tinify = require('tinify') // 压缩
const reg = /\.(png|jpg|jpeg|webp)$/; // 需要压缩的图片格式
tinify.key = 'VbdzjgXGqysc7wZKXs97JRGcxWld6MBQ'

// 创建一个提示行对象
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// 获取cpu 核数
const cpus = os.cpus().length

// 在node环境中，输出不一样的颜色
function chalkConsole({ color = 'green', str }) {
  console.log(chalk[color].bold(str))
}

// 启动函数
function start(path) {
  try {
    const windowPathReg = /(?:\\\\[^\\]+|[a-zA-Z]:)((?:\\[^\\]+)+\\)?([^<>:]*)/
    // linux文件路径
    const liunxPathReg =  /\/([\w\.]+\/?)*/;
    if (!windowPathReg.test(path) && !liunxPathReg.test(path)) {
      chalkConsole({ color: 'red', str: '请输入正确的路径' });
      rl.close()
      return
    }
    comPressThePicture(path) // 压缩图片
  } catch (err) {
    console.log('我报错了', err)
  }
  
}

/**
 * 获取图片大小和单位
 * @param {*} size 图片原始大小
 * @returns { fileSize: 'xxx', unit: 'xx' }
 */
function getFileSize(size) {
  const units = ['kb', 'mb', 'gb', 'tb']
  let num = 0
  if (size < 1024) { // 如果是字节
    return {
      fileSize: Math.floor(size),
      unit: 'byte'
    }
  }
  function _getFileSize(_size) {
    if (_size / 1024 > 1024) {
      num++
      return _getFileSize(_size / 1024)
    }
    return {
      fileSize: Math.floor(_size / 1024),
      unit: units[num]
    }
  }
  return _getFileSize(size)
}

// 获取单个文件详细信息
async function getSingleFileInfo(path) {
  const result = await fs.stat(path)
  Object.assign(result, getFileSize(result.size))
  return result
}

/**
 * 获取该路径下所有的图片并返回信息
 * @param {string} root 开始搜寻的目录 
 * @returns 
 */
async function getFileDirectory(root) {
  const fileDirectory = await fs.readdir(root) // 拿到命令文件夹下的目录
  const result = []
  for (const filePath of fileDirectory) {
    const curPath = path.resolve(root, filePath)
    const info = await getSingleFileInfo(curPath)
    // 排除掉没用的目录
    if (!(reg.test(filePath) || info.isDirectory() && filePath !== 'node_modules')) continue
    const isFile = info.isFile()
    // 如果是目录，则需要递归
    if (!isFile) {
      result.push(...await getFileDirectory(curPath))
      continue
    }
    result.push({
      isFile: isFile,
      name: filePath,
      ...getFileSize(info.size), // 该函数返回这个文件的大小和单位 { fileSize: xxx, unit: xxx }
      path: path.resolve(root, filePath)
    })
  }
  return result
}


// 根据拿到的图片去压缩，并原图覆盖
async function comPressThePicture(assetsPath) {
  let result = null
  try {
    result = await getFileDirectory(assetsPath)
  } catch (err) {
    // chalkConsole({ color: 'red', str: '请检查目录是否正确' })
    // await getUserQuestion(rl) // 重新询问用户
    rl.close()
    return
  }
  chalkConsole({ str: `共有${result.length}张图片, 开始压缩` })
  const processNum = result.length > cpus ? cpus : result.length;
  const optimalSolution = getOptimalSolution(result.length, processNum);
  const resultSlice = optimalSolution.map((num) => (result.splice(0, num)));
  let finishNum = 0
  for (let i = 0; i < processNum; i++) {
    child_process.exec('ls', async () => {
      await toCompress(resultSlice[i], i + 1);
      if (++finishNum === processNum) {
        chalkConsole({ str: '压缩结束，感谢您的使用!' })
        rl.close()
      }
    })
  }
}

async function toCompress(result, child_process_num) {
  let curIndex = 1
  for (const file of result) {
    const prevSize = file.fileSize
    chalkConsole({ str: `进程${child_process_num}正在压缩第${curIndex}张[${file.name}]` })
    try {
      const source = tinify.fromFile(file.path)
      await source.toFile(file.path) // 开始压缩图片
      chalkConsole({ str: `进程${child_process_num}第${curIndex}张压缩完成` })
      const { fileSize, unit } = await getSingleFileInfo(file.path)
      const reduction = fileSize > prevSize ? Math.floor(((prevSize * 1000 - fileSize) / (prevSize * 1000)) * 100) : Math.floor(((prevSize - fileSize) / prevSize) * 100)
      console.log(chalk.green.bold(`压缩前：${prevSize}${file.unit}，压缩后：${fileSize}${unit}, 减少了${reduction}%`))
    } catch (err) {
      chalkConsole({ str: `第${curIndex}张压缩失败[${file.name}]` })
    }
    curIndex++
  }
  rl.close()
}

function getOptimalSolution(num, length) {
  const result = new Array(length).fill(Math.floor(num / length));
  const remainder = num % length

  for (let i = 0; i < remainder; i++) {
    result[i]++
  }
  return result
}



module.exports = start;
