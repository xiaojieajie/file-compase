/* eslint-disable no-console */
const cluster = require('cluster')

module.exports = openProgess = (cpulen) => {
  if (cluster.isPrimary) {
    for (let i = 0; i < cpulen; i++) {
      // 如果是主进程，生成一个新的工作进程。
      const work = cluster.fork() // 该api只能在主进程调用
      work.send([i, process.pid])
      work.on('exit', (code, signal) => {
        if (signal)
          console.log(`worker was killed by signal: ${signal}`)
        else if (code !== 0)
          console.log(`worker exited with error code: ${code}`)
        else
          console.log('worker success!')
      })
    }
  } else if (cluster.isWorker) {
    // 如果进程不是主进程，它是isPrimary的否定
    console.log(`Worker ${process.pid} started`, 'oooooo')
  }
}

cluster.on('exit', (code, signal) => {
  if (signal)
    console.log(`worker was killed by signal: ${signal}`)
  else if (code !== 0)
    console.log(`worker exited with error code: ${code.id}`)
  else
    console.log('worker success!')
})
