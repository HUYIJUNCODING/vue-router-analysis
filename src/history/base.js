/* @flow */

import { _Vue } from '../install'
import type Router from '../index'
import { inBrowser } from '../util/dom'
import { runQueue } from '../util/async'
import { warn, isError, isExtendedError } from '../util/warn'
import { START, isSameRoute } from '../util/route'
import {
  flatten,
  flatMapComponents,
  resolveAsyncComponents
} from '../util/resolve-components'
import { NavigationDuplicated } from './errors'

export class History {
  router: Router
  base: string
  current: Route
  pending: ?Route
  cb: (r: Route) => void
  ready: boolean
  readyCbs: Array<Function>
  readyErrorCbs: Array<Function>
  errorCbs: Array<Function>

  // implemented by sub-classes
  +go: (n: number) => void
  +push: (loc: RawLocation) => void
  +replace: (loc: RawLocation) => void
  +ensureURL: (push?: boolean) => void
  +getCurrentLocation: () => string

  constructor (router: Router, base: ?string) {
    //将router实例挂载到history实例上
    this.router = router
    //规范化base,如果未配置则给默认值:'/'
    this.base = normalizeBase(base)

    // start with a route object that stands for "nowhere"
    //START: 初始化一个原始current对象（初始化current),项目最开始启动时的current就是这里的START
    /**
     * fullPath: "/"
     * hash: ""
     * matched: []
     * meta: {}
     * name: null
     * params: {}
     * path: "/"
     * query: {}
     */
    this.current = START
   
    this.pending = null
    this.ready = false
    this.readyCbs = []
    this.readyErrorCbs = []
    this.errorCbs = []
  }

  listen (cb: Function) {
    this.cb = cb
  }

  onReady (cb: Function, errorCb: ?Function) {
    if (this.ready) {
      cb()
    } else {
      this.readyCbs.push(cb)
      if (errorCb) {
        this.readyErrorCbs.push(errorCb)
      }
    }
  }

  onError (errorCb: Function) {
    this.errorCbs.push(errorCb)
  }
  
/**
 * 路由过渡(路由切换):很重要的方法
 */
  transitionTo (
    location: RawLocation, //目标 location
    onComplete?: Function, //成功后的回调函数
    onAbort?: Function
  ) {
    //调用match方法,匹配routeRecord生成新的rotue(最终态route,this.$route就是这个route)
    const route = this.router.match(location, this.current) 
    //执行confirmTransition 确认过渡方法(该方法会执行真正的路由切换)
    this.confirmTransition(
      route,
      () => { //该回调函数在下方第二个runQueue()中执行
        //更新当前路由 this.current = route, app._route = route
        this.updateRoute(route)
        onComplete && onComplete(route)
        //执行变更url(将url中的路由地址替换成最新的)
        this.ensureURL()

        // fire ready cbs once
        if (!this.ready) {
          this.ready = true
          this.readyCbs.forEach(cb => {
            cb(route)
          })
        }
      },
      err => {
        if (onAbort) {
          onAbort(err)
        }
        if (err && !this.ready) {
          this.ready = true
          this.readyErrorCbs.forEach(cb => {
            cb(err)
          })
        }
      }
    )
  }

  /**
   * 确认路由过渡:很重要的方法,该方法内会真正的执行路由切换
   */
  confirmTransition (route: Route, onComplete: Function, onAbort?: Function) {
    //当前激活态路由(组件中的this.$route),初始值是在在当前History类的构造方法中进行初始化的 this.current = START
    const current = this.current
    //发生阻断异常时调用,正常不用管
    const abort = err => {
      // after merging https://github.com/vuejs/vue-router/pull/2771 we
      // When the user navigates through history through back/forward buttons
      // we do not want to throw the error. We only throw it if directly calling
      // push/replace. That's why it's not included in isError
      if (!isExtendedError(NavigationDuplicated, err) && isError(err)) {
        if (this.errorCbs.length) {
          this.errorCbs.forEach(cb => {
            cb(err)
          })
        } else {
          warn(false, 'uncaught error during route navigation:')
          console.error(err)
        }
      }
      onAbort && onAbort(err)
    }
    //如果route 跟current 完全相同,则阻断路由跳转
    if (
      isSameRoute(route, current) &&
      // in the case the route map has been dynamically appended to
      route.matched.length === current.matched.length
    ) {
      this.ensureURL()
      return abort(new NavigationDuplicated(route))
    }

    //解析队列,对 this.current.matched, route.matched中的routRecord遍历一一对比,提取出updated(相同routeRecord),
    //deactivated(current中将要失活的routeRecord),activated(route中即将激活的routeRecord)
    const { updated, deactivated, activated } = resolveQueue(
      this.current.matched,
      route.matched
    )
   
    //路由对列，类型为数组
    const queue: Array<?NavigationGuard> = [].concat(
      // in-component leave guards
      //提取deactivated数组中所有失活组件的beforeRouteLeave(离开守卫)
      extractLeaveGuards(deactivated),
      // global before hooks
      //全局的beforeEach守卫
      this.router.beforeHooks,
      // in-component update hooks
      //提取updated中所有可复用的组件中的beforeRouteUpdate 守卫
      extractUpdateHooks(updated),
      // in-config enter guards
      //提取 actived 数组将要激活的路由配置中定义的 beforeEnter 守卫。
      activated.map(m => m.beforeEnter),
      // async components
      //解析activated数组中所有routeRecord里的异步路由组件
      resolveAsyncComponents(activated)
    )

    //迭代器,用来迭代queue对列
    this.pending = route
    const iterator = (hook: NavigationGuard, next) => {
      
      if (this.pending !== route) {
        return abort()
      }
      try {
        //hook就是当前要执行的守卫,标准的hook(to,from,next)格式,是不是很熟悉呀。
        hook(route, current, (to: any) => {
          if (to === false || isError(to)) {
            // next(false) -> abort navigation, ensure current URL
            //next(false)阻断执行下一个守卫
            this.ensureURL(true)
            abort(to)
          } else if (//切换路由线路
            typeof to === 'string' ||
            (typeof to === 'object' &&
              (typeof to.path === 'string' || typeof to.name === 'string'))
          ) {
            // next('/') or next({ path: '/' }) -> redirect
            abort()
            if (typeof to === 'object' && to.replace) {
              this.replace(to)
            } else {
              this.push(to)
            }
          } else {
            // confirm transition and pass on the value
            //执行 step(index + 1),让循环继续执行这就是为啥守卫中一定要写next()才可以继续向下执行下一个守卫的原因
            next(to)
          }
        })
      } catch (e) {
        abort(e)
      }
    }

    /**
     * 执行对列(就是使用iterator迭代器迭代执行queue队列)
     */
    runQueue(queue, iterator, () => {
      const postEnterCbs = []
      const isValid = () => this.current === route
      // wait until async components are resolved before
      // extracting in-component enter guards
      //提取到actived数组中所有将要激活组件的beforeRouteEnter守卫
      const enterGuards = extractEnterGuards(activated, postEnterCbs, isValid)
      //queue中加入resolveHooks([beforeResolve])
      const queue = enterGuards.concat(this.router.resolveHooks)
      //再次执行queue对列(采用iterator迭代queue),注意此时的queue只包含的是[beforeRouteEnter]和[beforeResolve]数组
      runQueue(queue, iterator, () => {
        if (this.pending !== route) {
          return abort()
        }
        this.pending = null
        //对列执行完成后执行onComplete方法
        onComplete(route)
        //
        if (this.router.app) {
          this.router.app.$nextTick(() => {
            postEnterCbs.forEach(cb => {
              cb()
            })
          })
        }
      })
    })
  }

/**
 * 更新路由,该方法的执行会触发<route-view>重新渲染组件
 */
  updateRoute (route: Route) {
    const prev = this.current
    this.current = route //将最新的route赋值给current
    this.cb && this.cb(route)//这里的cb就是我们之前在 src->index.js 的init方法最后调用 history.listen()传入的那个回调函数
    //最终会执行 app._route = route, <route-view> 组件的render 函数对_route有依赖,因此_route改变,render函数会重新执行,因此更新视图

    //执行afterafterHooks(afterEach)守卫
    this.router.afterHooks.forEach(hook => {
      hook && hook(route, prev)
    })
  }
}

/**
 * 格式化base路径
 * @param {*} base 
 */
function normalizeBase (base: ?string): string {
  //如果base为配置,则给默认值
  if (!base) {
    if (inBrowser) {
      // respect <base> tag
      const baseEl = document.querySelector('base')
      base = (baseEl && baseEl.getAttribute('href')) || '/'
      // strip full URL origin
      base = base.replace(/^https?:\/\/[^\/]+/, '')
    } else {
      base = '/'
    }
  }
  // make sure there's the starting slash
  if (base.charAt(0) !== '/') { //如果配置了base但不是以'/'开头,则强制开头加'/'
    base = '/' + base
  }
  // remove trailing slash 将base尾部的'/'用''代替去掉
  return base.replace(/\/$/, '')
}

/**
 * 解析队列,通过遍历对比current.matched和route.matched数组的routRecord,得到updated,activated,deactivated然后返回
 * @param {*} current 
 * @param {*} next 
 */
function resolveQueue (
  current: Array<RouteRecord>, //current.matched
  next: Array<RouteRecord> //route.matched
): {
  updated: Array<RouteRecord>,
  activated: Array<RouteRecord>,
  deactivated: Array<RouteRecord>
} {
  let i
  const max = Math.max(current.length, next.length)
  for (i = 0; i < max; i++) {
    //遍历直到当两者第i项不相等时break结束循环
    if (current[i] !== next[i]) {
      break
    }
  }
  return {
    updated: next.slice(0, i),//next中0到i(不包括i)为updated(相同routeRecord)
    activated: next.slice(i),//next中 i到结束为要激活routeRecord
    deactivated: current.slice(i)//current中 i到结束为要失活routeRecord
  }
}

/**
 * 提取 RouteRecord 中指定 name 的守卫
 * @param {*} records 
 * @param {*} name 
 * @param {*} bind 
 * @param {*} reverse 
 */
function extractGuards (
  records: Array<RouteRecord>,
  name: string,
  bind: Function,
  reverse?: boolean
): Array<?Function> {
  //guards 是一个 '给instance绑定指定name 守卫' 的函数，或函数数组
  const guards = flatMapComponents(records, (def, instance, match, key) => {
    //获取到records数组中 routeRecord 下的所有组件里面指定 name 的守卫
    const guard = extractGuard(def, name)
    if (guard) {
       //返回 一个专门为instance绑定guard守卫的函数（或函数数组）,当绑定函数每次执行,instance就会调用一次当前guard路由守卫
      return Array.isArray(guard)
        ? guard.map(guard => bind(guard, instance, match, key))
        : bind(guard, instance, match, key)
    }
  })
  //返回获取到的指定 name 守卫的数组
  return flatten(reverse ? guards.reverse() : guards)
}

/**
 * 获取def 组件中 指定名称的守卫
 * @param {*} def 
 * @param {*} key 
 */
function extractGuard (
  def: Object | Function,
  key: string
): NavigationGuard | Array<NavigationGuard> {
  if (typeof def !== 'function') {
    // extend now so that global mixins are applied.
    def = _Vue.extend(def)
  }
  return def.options[key]
}

/**
 * 提取所有即将失活组件中定义的 beforeRouteLeave 守卫。
 * @param {*} deactivated 
 */
function extractLeaveGuards (deactivated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
}

/**
 * 提取所有可以复用组件中定义的beforeRouteUpdate 守卫
 * @param {*} updated 
 */
function extractUpdateHooks (updated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(updated, 'beforeRouteUpdate', bindGuard)
}

/**
 * 绑定guard 守卫到组件实例instance上
 * @param {*} guard 
 * @param {*} instance 
 */
function bindGuard (guard: NavigationGuard, instance: ?_Vue): ?NavigationGuard {
  if (instance) {
    //boundRouteGuard方法就是用来执行绑定的守卫(因为调用一次该方法,instance就会作为guard执行上下文调用guard)
    return function boundRouteGuard () {
      return guard.apply(instance, arguments)
    }
  }
}

/**
 * 提取actived数组中所有激活组件中的beforeRouteEnter守卫
 * @param {*} activated 
 * @param {*} cbs 
 * @param {*} isValid 
 */
function extractEnterGuards (
  activated: Array<RouteRecord>,
  cbs: Array<Function>,
  isValid: () => boolean
): Array<?Function> {
  return extractGuards(
    activated,
    'beforeRouteEnter',
    (guard, _, match, key) => {
      return bindEnterGuard(guard, match, key, cbs, isValid)
    }
  )
}

/**
 * 绑定beforeRouteEnter会看到返回一个routeEnterGuard函数,当routeEnterGuard被执行的时候会返回guard.这里执行的guard就是
 * beforeRouteEnter,注意下它的第三个参数(就是next函数)接收一个cb(回调),这个cb回调就是官方文档中特别提到的那个因为在beforeRouteEnter
 * 中拿不到当前组件实例,可以给next函数传入一个回调来访问组件实例的回调函数,cb如果是一个函数就会被push进cbs这个数组中,
 * 你可以向上追踪cbs会发现就是runQueue函数中第一行定义的那个postEnterCbs数组,这数组会在onComplete中执行,此时遍历postEnterCbs拿到cb然后调用
 * cb,这就是那句 '用创建好的实例调用 beforeRouteEnter 守卫中传给 next 的回调函数'。
 * @param {*} guard 
 * @param {*} match 
 * @param {*} key 
 * @param {*} cbs 
 * @param {*} isValid 
 */
function bindEnterGuard (
  guard: NavigationGuard,
  match: RouteRecord,
  key: string,
  cbs: Array<Function>,
  isValid: () => boolean
): NavigationGuard {
  return function routeEnterGuard (to, from, next) {
    return guard(to, from, cb => {
      if (typeof cb === 'function') {
        cbs.push(() => {
          // #750
          // if a router-view is wrapped with an out-in transition,
          // the instance may not have been registered at this time.
          // we will need to poll for registration until current route
          // is no longer valid.
          poll(cb, match.instances, key, isValid)
        })
      }
      next(cb)
    })
  }
}

/**
 * 这个方法用来执行cb回调的
 * @param {*} cb 
 * @param {*} instances 
 * @param {*} key 
 * @param {*} isValid 
 */
function poll (
  cb: any, // somehow flow cannot infer this is a function
  instances: Object,
  key: string,
  isValid: () => boolean
) {
  if (
    instances[key] &&
    !instances[key]._isBeingDestroyed // do not reuse being destroyed instance
  ) {
    //instances[key]为当前vue组件实例 就是官方文档中的例子 'next(vm => { 通过 `vm` 访问组件实例}' 的vm 
    cb(instances[key])
  } else if (isValid()) {
    //这里使用轮序器的原因是路由组件有可能被套在transition 組件下,此时在一些缓动模式下不一定能拿到实例，
    //所以用一个轮询方法不断去判断，直到能获取到组件实例，再去调用 cb
    setTimeout(() => {
      poll(cb, instances, key, isValid)
    }, 16)
  }
}
