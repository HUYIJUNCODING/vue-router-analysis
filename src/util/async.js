/* @flow */

//执行对列 fn为迭代器,cb为对列执行完成后的回调
export function runQueue (queue: Array<?NavigationGuard>, fn: Function, cb: Function) {
  const step = index => {
    if (index >= queue.length) {
      //对列执行完毕后的回调
      cb()
    } else {
      //使用fn(迭代器)执行对列中的每一项
      if (queue[index]) {
        fn(queue[index], () => {
          step(index + 1)
        })
      } else {
        step(index + 1)
      }
    }
  }
  //开始
  step(0)
}
