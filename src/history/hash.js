/* @flow */

import type Router from '../index'
import { History } from './base'
import { cleanPath } from '../util/path'
import { getLocation } from './html5'
import { setupScroll, handleScroll } from '../util/scroll'
import { pushState, replaceState, supportsPushState } from '../util/push-state'

export class HashHistory extends History {
  constructor (router: Router, base: ?string, fallback: boolean) {
    super(router, base)
    // check history fallback deeplinking
    //说明当前浏览器不支持history模式,则采用hash模式降级处理
    if (fallback && checkFallback(this.base)) {
      return
    }
    //这里是hash模式下的url中路由地址的初始化,比如我们本地启动项目的时候 用的是http://localhost:8080,但会发现启动后尾部会自动加上/#/ 变成: http://localhost:8080/#/,
    //这个末尾加/#/就是这里完成的
    ensureSlash()
  }

  // this is delayed until the app mounts
  // to avoid the hashchange listener being fired too early
  setupListeners () {
    const router = this.router
    const expectScroll = router.options.scrollBehavior
    const supportsScroll = supportsPushState && expectScroll

    if (supportsScroll) {
      setupScroll()
    }

    window.addEventListener(
      supportsPushState ? 'popstate' : 'hashchange',
      () => {
        const current = this.current
        if (!ensureSlash()) {
          return
        }
        this.transitionTo(getHash(), route => {
          if (supportsScroll) {
            handleScroll(this.router, route, current, true)
          }
          if (!supportsPushState) {
            replaceHash(route.fullPath)
          }
        })
      }
    )
  }

  /**
   * push方法
   * @param {*} location 
   * @param {*} onComplete 
   * @param {*} onAbort 
   */
  push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(
      location,
      route => {//确认路由切换后的成功回调函数,在confirmTransition中执行
        //通过调用浏览器原生history对象下的pushState方法将当前浏览器url地址更改为目标路由地址,注意这里只更改浏览器url地址,并不会
        //更新页面重新渲染,页面重新渲染是通过app_route=route引起<route-view>组件render函数执行的.触发渲染在该回调函数调用地方的上一行代码中
       // ('就是base.js里的transitionTo方法中的第二个参数(回调函数)里的 this.updateRoute(route)这句代码')

      
        pushHash(route.fullPath)//切换浏览器url
        handleScroll(this.router, route, fromRoute, false)
        onComplete && onComplete(route)
      },
      onAbort
    )
  }

  /**
   * replace方法
   * @param {*} location 
   * @param {*} onComplete 
   * @param {*} onAbort 
   */
  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(
      location,
      route => {
        replaceHash(route.fullPath)
        handleScroll(this.router, route, fromRoute, false)
        onComplete && onComplete(route)
      },
      onAbort
    )
  }

  go (n: number) {
    window.history.go(n)
  }

  /**
   * 锁定url(也就是将url地址变更成最新的)
   * @param {*} push 
   */
  ensureURL (push?: boolean) {
    const current = this.current.fullPath
    if (getHash() !== current) {
      push ? pushHash(current) : replaceHash(current)
    }
  }

  /**
   * 获取当前 浏览器url地址 hash 内容 (#号后面的东西)
   */
  getCurrentLocation () {
    return getHash()
  }
}

function checkFallback (base) {
  const location = getLocation(base)
  if (!/^\/#/.test(location)) {
    window.location.replace(cleanPath(base + '/#' + location))
    return true
  }
}

/**
 * 保证默认进入的时候对应的 hash 值是以 / 开头的，如果不是则给hash值前开头强制加'/'(始终保持hash值是以'/'开头)。
 */
function ensureSlash (): boolean {
  const path = getHash()
  if (path.charAt(0) === '/') {
    return true
  }
  replaceHash('/' + path)
  return false
}

/**
 * 获取浏览器url地址hash(#后面的东西)
 */
export function getHash (): string {
  // We can't use window.location.hash here because it's not
  // consistent across browsers - Firefox will pre-decode it!
  //我们不能在这里使用 window.location.hash，因为它不是,跨浏览器一致-Firefox将对其进行预解码

  let href = window.location.href //当前url地址 例如:http://www.myurl.com:8080/#/list/detail?id=123&username=xxx
  const index = href.indexOf('#')
  // empty path 如果#不存在,则直接返回 ''
  if (index < 0) return ''

  href = href.slice(index + 1) //拿到 # 后面的部分重新给 href
  // decode the hash but not the search or hash
  // as search(query) is already decoded
  // https://github.com/vuejs/vue-router/issues/2708
  const searchIndex = href.indexOf('?')
  if (searchIndex < 0) {// '?' 不存在
    const hashIndex = href.indexOf('#')
    if (hashIndex > -1) {//# 存在
      href = decodeURI(href.slice(0, hashIndex)) + href.slice(hashIndex)
    } else href = decodeURI(href)
  } else { // '?' 存在
    href = decodeURI(href.slice(0, searchIndex)) + href.slice(searchIndex)
  }

  return href
}

/**
 * 获取当前路由页面对应的完成url 域名+端口 + # + fullPath
 * @param {*} path 
 */
function getUrl (path) {//path: fullPath
  const href = window.location.href 
  const i = href.indexOf('#')
  const base = i >= 0 ? href.slice(0, i) : href
  return `${base}#${path}`
}

function pushHash (path) {//path: fullPath
  if (supportsPushState) {  //如果支持原生 history.pushState 方法则采用pushState更改当前浏览器页面栈记录
    pushState(getUrl(path))
  } else {
    window.location.hash = path //否则采用直接替换hash方式
  }
}

function replaceHash (path) {
  if (supportsPushState) {
    replaceState(getUrl(path))// history.replaceState
  } else {
    window.location.replace(getUrl(path)) //replace():Removes the current page from the session history and navigates to the given URL.
  }
}
