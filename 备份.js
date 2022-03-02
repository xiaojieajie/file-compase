const fs = require('fs').promises // 文件模块
const os = require('os')
const openProgess = require('./utils/cluster')
const util = require('util')
const chalk = require('chalk') // 控制台模块
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

// question promise封装
const question = util.promisify(rl.question).bind(rl)


// 获取cpu 核数
const cpus = os.cpus().length



/**
 * 询问用户操作，如果用户回答是对的，则返回，否则继续询问
 * @param {readline.createInterface()} rl readline创建器返回的对象
 * @param {string} tipsMsg 询问用户的文字
 * @param {string} errMsg 用户输入错误提示的文字
 * @param {function} condition 条件 返回true满足，返回false不满足
 * @returns 用户输入信息
 */
async function askingHandler({ rl, tipsMsg, errMsg, condition }) {
  // rl.resume() // 重新询问
  // 如果用户输入的正确，返回用户输入，否贼递归
  const answer = await question(tipsMsg)
  if (answer === 'exit') {
    rl.close()
    return false
  }
  if (condition(answer)) {
    return answer
  }
  chalkConsole({ color: 'red', str: errMsg }) // 提示
  return await askingHandler({ rl, tipsMsg, errMsg, condition })
}

/**
 * 获取用户输入
 * @param {*} rl 
 * @returns 
 */
async function getUserQuestion(rl) {
  const liunxPathReg = /^\/(\w+\/?)+$/
  const windowPathReg = /(?:\\\\[^\\]+|[a-zA-Z]:)((?:\\[^\\]+)+\\)?([^<>:]*)/
  return await askingHandler({
    rl,
    tipsMsg: '请输入路径(或输入exit退出)：',
    errMsg: '请输入正确的路径, 或按 ctrl + c 退出命令',
    condition: answer => answer && windowPathReg.test(answer) || liunxPathReg.test(answer)
  })
}

// 在node环境中，输出不一样的颜色
function chalkConsole({ color = 'green', str }) {
  console.log(chalk[color].bold(str))
}

// 启动函数
async function init() {
  try {
    const userPath = await getUserQuestion(rl) // 获取用户输入
    if (!userPath) {
      rl.close()
      return
    }
    // rl.pause()
    comPressThePicture(userPath) // 压缩图片
  } catch (err) {
    console.log('我报错了', err)
  }
  
}

init()

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
    await getUserQuestion(rl) // 重新询问用户
    return
  }

  chalkConsole({ str: `共有${result.length}张图片` })
  
  const ask = await askingHandler({ rl, tipsMsg: '是否要进行压缩，输入1开始压缩：', errMsg: '请输入1开启压缩，或使用ctrl+c ｜ exit退出程序', condition: answer => Number(answer) === 1 })
  if (!ask) return
  rl.close()
  chalkConsole({ str: `正在自动压缩中，请不要关闭进程` })
  
  await multiprocessCompress(result)
  // 根据图片的数量决定开几个进程
  
  // await toCompress(result)
}

async function toCompress(result) {
  let curIndex = 1
  for (const file of result) {
    const prevSize = file.fileSize
    chalkConsole({ str: `正在压缩第${curIndex}张[${file.name}]` })
    try {
      const source = tinify.fromFile(file.path)
      await source.toFile(file.path) // 开始压缩图片
      chalkConsole({ str: `第${curIndex}张压缩完成` })
      const { fileSize, unit } = await getSingleFileInfo(file.path)
      const reduction = fileSize > prevSize ? Math.floor(((prevSize * 1000 - fileSize) / (prevSize * 1000)) * 100) : Math.floor(((prevSize - fileSize) / prevSize) * 100)
      console.log(chalk.green.bold(`压缩前：${prevSize}${file.unit}，压缩后：${fileSize}${unit}, 减少了${reduction}%`))
    } catch (err) {
      chalkConsole({ str: `第${curIndex}张压缩失败[${file.name}]` })
    }
    curIndex++
  }
  chalkConsole({ str: '压缩结束，感谢您的使用!' })
  rl.close()
}

async function multiprocessCompress(result) {
  console.log('我来执行这个了')
  rl.close()
  const reqQuantify = result.length > cpus ? Math.ceil(result.length / cpus) : result.length
  openProgess(reqQuantify)
  
  process.on('message', async ([index, _]) => {
    curIndex++
    console.log(index)
    // await toCompress(result.slice(0, 2))
  })
}