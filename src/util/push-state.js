/* @flow */

import { inBrowser } from './dom'
import { saveScrollPosition } from './scroll'
import { genStateKey, setStateKey, getStateKey } from './state-key'
import { extend } from './misc'

export const supportsPushState =
  inBrowser &&
  (function () {
    const ua = window.navigator.userAgent

    if (
      (ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
      ua.indexOf('Mobile Safari') !== -1 &&
      ua.indexOf('Chrome') === -1 &&
      ua.indexOf('Windows Phone') === -1
    ) {
      return false
    }

    return window.history && 'pushState' in window.history
  })()

  /**
   * 该方法会调用浏览器原生的 history对象的 pushState 或 replaceState 方法，
   * 添加(pushState)或者修改(replaceState)浏览器页面栈历史记录会更新浏览器地址栏url地址.
   * @param {*} url 
   * @param {*} replace 
   */
export function pushState (url?: string, replace?: boolean) {
  //滚动位置有关的方法
  saveScrollPosition()
  // try...catch the pushState call to get around Safari
  // DOM Exception 18 where it limits to 100 pushState calls
  const history = window.history
  try {
    //采用replace的路由切换方式,则调用 history.replaceState()方法直接修改浏览器当前页面记录
    if (replace) {
      // preserve existing history state as it could be overriden by the user
      const stateCopy = extend({}, history.state)
      stateCopy.key = getStateKey()
      history.replaceState(stateCopy, '', url)
    } else {//否则是采用pushState的路由切换方式,则调用 history.pushState()方法新增一条记录给浏览器页面栈
      history.pushState({ key: setStateKey(genStateKey()) }, '', url)
    }
  } catch (e) {
    window.location[replace ? 'replace' : 'assign'](url)
  }
}

/**
 * replace方式,最终还是调用pushState方法,区别在于第二个参数:replace:true,表示调用history.repalceState()
 * @param {*} url 
 */
export function replaceState (url?: string) {
  pushState(url, true)
}
