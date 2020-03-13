/* @flow */

import type Router from '../index'
import { History } from './base'
import { cleanPath } from '../util/path'
import { START } from '../util/route'
import { setupScroll, handleScroll } from '../util/scroll'
import { pushState, replaceState, supportsPushState } from '../util/push-state'

export class HTML5History extends History {
  constructor (router: Router, base: ?string) {
    super(router, base)
   
    //滚动位置有关的属性
    const expectScroll = router.options.scrollBehavior
    const supportsScroll = supportsPushState && expectScroll
    //如果history模式下当前浏览器支持PushState方法则调用setupScroll方法去通过添加 popstate 监听 设置滚动位置
    if (supportsScroll) {
      setupScroll()
    }

    const initLocation = getLocation(this.base)
    // 当活动历史记录条目更改时，将触发popstate事件。(浏览器页面记录)
    // 调用history.pushState()或history.replaceState()不会触发popstate事件。
    // 只有在做出浏览器动作时，才会触发该事件，如用户点击浏览器的回退按钮
    // （或者在Javascript代码中调用history.back()或者history.forward()、history.go()方法）
    window.addEventListener('popstate', e => {
      //当前激活态的路由线路
      const current = this.current

      // Avoiding first `popstate` event dispatched in some browsers but first
      // history route not updated since async guard at the same time.
      const location = getLocation(this.base)
      if (this.current === START && location === initLocation) {
        return
      }
      //此时说明发生了页面栈前进或者回退,调用transitionTo方法去切换路由线路
      this.transitionTo(location, route => {
        if (supportsScroll) {
          //根据设置的滚动位置去执行滚动方法
          handleScroll(router, route, current, true)
        }
      })
    })
  }

  go (n: number) {
    window.history.go(n)
  }

  /**
   * push方法
   * @param {*} location 
   * @param {*} onComplete 
   * @param {*} onAbort 
   */
  push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(location, route => { //确认路由切换后的成功回调函数,在confirmTransition中执行
      //通过调用浏览器原生history对象下的pushState方法将当前浏览器url地址更改为目标路由地址,注意这里只更改浏览器url地址,并不会
      //更新页面重新渲染,页面重新渲染是通过app_route=route引起<route-view>组件render函数执行的.触发渲染在该回调函数调用的上一行代码中
     // ('就是base.js里的transitionTo方法中的第二个参数(回调函数)里的 this.updateRoute(route)这句代码')
      pushState(cleanPath(this.base + route.fullPath))
      //滚动位置有关
      handleScroll(this.router, route, fromRoute, false)
      //执行push方法传递进来的 onComplete 回调函数(如果没有传则默认执行resolve方法)
      onComplete && onComplete(route)
    }, onAbort)
  }

  /**
   * replace方法,跟push执行流程一样,只是调用浏览器原生 history 对象中的 replaceState()方法更新浏览器页面栈
   * @param {*} location 
   * @param {*} onComplete 
   * @param {*} onAbort 
   */
  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(location, route => {
      replaceState(cleanPath(this.base + route.fullPath))
      handleScroll(this.router, route, fromRoute, false)
      onComplete && onComplete(route)
    }, onAbort)
  }
  
  ensureURL (push?: boolean) {
    if (getLocation(this.base) !== this.current.fullPath) {
      const current = cleanPath(this.base + this.current.fullPath)
      push ? pushState(current) : replaceState(current)
    }
  }

  
  getCurrentLocation (): string {
    return getLocation(this.base)
  }
}

export function getLocation (base: string): string {
  let path = decodeURI(window.location.pathname)
  if (base && path.indexOf(base) === 0) {
    path = path.slice(base.length)
  }
  return (path || '/') + window.location.search + window.location.hash
}
