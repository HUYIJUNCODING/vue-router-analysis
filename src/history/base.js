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
    //规范化base 
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
    //执行confirmTransition 确认过渡方法(该方法会执行真正的路由跳转)
    this.confirmTransition(
      route,
      () => {
        //更新route
        this.updateRoute(route)
        onComplete && onComplete(route)
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
   
    //
    const queue: Array<?NavigationGuard> = [].concat(
      // in-component leave guards
      //提取deactivated数组中所有失活组件的beforeRouteLeave(离开守卫)
      extractLeaveGuards(deactivated),
      // global before hooks
      //全局的beforeEach钩子函数
      this.router.beforeHooks,
      // in-component update hooks
      //提取updated中所有可复用的组件中的beforeRouteUpdate路由钩子函数
      extractUpdateHooks(updated),
      // in-config enter guards
      //提取到actived数组中将要激活的路由配置中定义的 beforeEnter 函数。
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
        //hook就是当前要执行的路由钩子函数,你看标准的hook(to,from,next)格式,是不是很熟悉呀,对就是执行路由钩子函数啊
        hook(route, current, (to: any) => {
          if (to === false || isError(to)) {
            // next(false) -> abort navigation, ensure current URL
            //next(false)阻断执行下一个钩子函数
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
            //执行 step(index + 1),让循环继续执行这就是为啥钩子函数中一定要写next()才可以继续向下执行下一个钩子函数的原因
            next(to)
          }
        })
      } catch (e) {
        abort(e)
      }
    }

    runQueue(queue, iterator, () => {
      const postEnterCbs = []
      const isValid = () => this.current === route
      // wait until async components are resolved before
      // extracting in-component enter guards
      //提取到actived数组中所有将要激活组件的beforeRouteEnter路由钩子函数
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

  updateRoute (route: Route) {
    const prev = this.current
    this.current = route
    this.cb && this.cb(route)
    this.router.afterHooks.forEach(hook => {
      hook && hook(route, prev)
    })
  }
}

function normalizeBase (base: ?string): string {
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
  if (base.charAt(0) !== '/') {
    base = '/' + base
  }
  // remove trailing slash
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
 * 提取 RouteRecord中指定名称的的路由守卫(钩子)函数
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
  //guards为,一个存放功能为给instance绑定指定名称路由钩子函数的一维数组
  const guards = flatMapComponents(records, (def, instance, match, key) => {
    //获取到records数组中的routeREcord里的组件里面要获取的指定名称的路由钩子函数
    const guard = extractGuard(def, name)
    if (guard) {
      //返回instance的绑定guard钩子的绑定函数,当该函数每次执行,instance就会调用一次当前guard路由钩子函数
      return Array.isArray(guard)
        ? guard.map(guard => bind(guard, instance, match, key))
        : bind(guard, instance, match, key)
    }
  })
  //返回获取到的指定名称路由钩子函数的数组
  return flatten(reverse ? guards.reverse() : guards)
}

/**
 * 获取def 组件中 对应名称的路由钩子函数
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
 * 提取所有失活组件中定义的 beforeRouteLeave 路由钩子函数。
 * @param {*} deactivated 
 */
function extractLeaveGuards (deactivated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
}

/**
 * 提取所有可以复用组件中定义的beforeRouteUpdate路由钩子函数
 * @param {*} updated 
 */
function extractUpdateHooks (updated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(updated, 'beforeRouteUpdate', bindGuard)
}

/**
 * 绑定guard路由钩子函数到组件实例instance上
 * @param {*} guard 
 * @param {*} instance 
 */
function bindGuard (guard: NavigationGuard, instance: ?_Vue): ?NavigationGuard {
  if (instance) {
    //boundRouteGuard方法就是用来执行绑定路由钩子函数的(因为调用一次该方法,instance就会作为guard执行上下文调用guard)
    return function boundRouteGuard () {
      return guard.apply(instance, arguments)
    }
  }
}

/**
 * 提取actived数组中所有激活组件中的beforeRouteEnter路由钩子
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
 * 绑定beforeRouteEnter会看到返回一个routeEnterGuard函数,当routeEnterGuard被执行的时候会返回guard这里的执行guard就是执行
 * beforeRouteEnter,注意下他的第三个参数(就是next函数)接收一个cb(回调),这个cb回调就是官方文档中特别提到的那个因为在beforeRouteEnter
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
