/* @flow */

import { install } from './install'
import { START } from './util/route'
import { assert } from './util/warn'
import { inBrowser } from './util/dom'
import { cleanPath } from './util/path'
import { createMatcher } from './create-matcher'
import { normalizeLocation } from './util/location'
import { supportsPushState } from './util/push-state'

import { HashHistory } from './history/hash'
import { HTML5History } from './history/html5'
import { AbstractHistory } from './history/abstract'

import type { Matcher } from './create-matcher'

/**
 * VueRouter
 */
export default class VueRouter {
  //声明一个 install 静态方法，安装插件的 install方法会赋给它，下面会看到。
  static install: () => void
  static version: string

  app: any
  apps: Array<any>
  ready: boolean
  readyCbs: Array<Function>
  options: RouterOptions
  mode: string
  history: HashHistory | HTML5History | AbstractHistory
  matcher: Matcher
  fallback: boolean
  beforeHooks: Array<?NavigationGuard>
  resolveHooks: Array<?NavigationGuard>
  afterHooks: Array<?AfterNavigationHook>

  constructor(options: RouterOptions = {}) {
    this.app = null //表示vue根实例
    this.apps = [] // 保存拥有$options.router 属性的 Vue 实例,一般也就是vue根实例 [app]
    this.options = options //new VueRoter()时候传入的options路由配置
    this.beforeHooks = [] //保存beforeEach路由守卫
    this.resolveHooks = [] //保存beforeResolve路由守卫
    this.afterHooks = [] //保存afterEach路由守卫
    //路由匹配器,createMatcher会返回{ addRoutes,match }
    this.matcher = createMatcher(options.routes || [], this)

    //路由模式
    let mode = options.mode || 'hash'
    //当前浏览器不支持history模式,根据选项中fallback值(true/false)决定是否降级转为hash模式
    this.fallback =
      mode === 'history' && !supportsPushState && options.fallback !== false
    if (this.fallback) {
      mode = 'hash'
    }
    //不是浏览器环境(node.js下),采用抽象模式
    if (!inBrowser) {
      mode = 'abstract'
    }

    this.mode = mode

    //初始化对应模式下的history实例
    switch (mode) {
      case 'history':
        this.history = new HTML5History(this, options.base)
        break
      case 'hash':
        this.history = new HashHistory(this, options.base, this.fallback)
        break
      case 'abstract':
        this.history = new AbstractHistory(this, options.base)
        break
      default:
        if (process.env.NODE_ENV !== 'production') {
          assert(false, `invalid mode: ${mode}`)
        }
    }
  }

  /**
   * 执行路由匹配,会根据 raw:导航去哪的路由信息(就是我们使用push/replace方法的第一个参数) 和current:当前路由信息,计算匹配出一个新的route
   * 这个新的route就是最终的route(this.$route访问到的)
   * @param {*} raw
   * @param {*} current
   * @param {*} redirectedFrom
   */
  match(
    raw: RawLocation, //push方法的第一个参数(要去的路由)
    current?: Route, //当前路由信息(对象)
    redirectedFrom?: Location
  ): Route {
    //返回
    return this.matcher.match(raw, current, redirectedFrom)
  }

  get currentRoute(): ?Route {
    return this.history && this.history.current
  }

  /**
   * 初始化router
   * @param {*} app //app为Vue根实例
   */
  init(app: any /* Vue component instance */) {
    //断言插件是否已被安装，如果否，则报错提示。
    process.env.NODE_ENV !== 'production' &&
      assert(
        install.installed,
        `not installed. Make sure to call \`Vue.use(VueRouter)\` ` +
          `before creating root instance.`
      )
    //apps是个数组，专门用来存放app实例（vue根实例）
    this.apps.push(app)

    // set up app destroyed handler 给app（vue根实例）设置 destroyed监听事件，如果实例销毁则会触发一次回调函数。
    // https://github.com/vuejs/vue-router/issues/2639
    app.$once('hook:destroyed', () => {
      // clean out app from this.apps array once destroyed
      //将app从apps中移除
      const index = this.apps.indexOf(app)
      if (index > -1) this.apps.splice(index, 1)
      // ensure we still have a main app or null if no apps
      // we do not release the router so it can be reused
      //确保我们仍然有一个主 app,如果apps不存在则 app为null，
      //由于没有释放router,因此router可以被再次重复利用。
      if (this.app === app) this.app = this.apps[0] || null
    })

    // main app previously initialized
    // return as we don't need to set up new history listener
    //如果app之前已经初始化过了，那就不需要再重新设置一个新的 history监听
    if (this.app) {
      return
    }
    //将Vue根实例挂载到router实例的app内置属性上
    this.app = app
    //history实例
    const history = this.history
    //如果当前 history实例是 HTML5History 类型，则直接执行 transitionTo 方法去执行切换当前路由线路相关逻辑
    if (history instanceof HTML5History) {
      history.transitionTo(history.getCurrentLocation()) //history.getCurrentLocation() 返回的是 '/'+base + search+hash
      //如果是hash类型,则先设置history监听方法,然后再调用transitionTo切换当前路由线路相关逻辑
    } else if (history instanceof HashHistory) {
      const setupHashListener = () => {
        history.setupListeners()
      }
      history.transitionTo(
        history.getCurrentLocation(), //浏览器地址栏 # 后面的部分
        setupHashListener,
        setupHashListener
      )
    }

    //给history设置路由监听,listen这个方法定义在src/history/base.js中,listen回调会在confirmTransition方法回调函数的updateRoute方法中执行
    //因为_route保存的是 this._router.history.current 当current路由切换时,_route会改变,又因为是响应式(在install.js的混入beforeCreate方法中定义的)
    //所以会更新视图(<router-view> render 函数依赖_route)
    history.listen(route => {
      this.apps.forEach(app => {
        app._route = route
      })
    })
  }

  /**
   * 注册 beforeEach 路由钩子函数
   * @param {*} fn
   */
  beforeEach(fn: Function): Function {
    return registerHook(this.beforeHooks, fn)
  }

  /**
   * 注册 beforeResolve 路由钩子函数
   * @param {*} fn
   */
  beforeResolve(fn: Function): Function {
    return registerHook(this.resolveHooks, fn)
  }

  /**
   * 注册 afterEach 路由钩子函数
   *
   * @param {*} fn
   */
  afterEach(fn: Function): Function {
    return registerHook(this.afterHooks, fn)
  }

  onReady(cb: Function, errorCb?: Function) {
    this.history.onReady(cb, errorCb)
  }

  onError(errorCb: Function) {
    this.history.onError(errorCb)
  }

  /**
   * push 方法
   * @param {*} location
   * @param {*} onComplete
   * @param {*} onAbort
   */
  push(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    // $flow-disable-line
    if (!onComplete && !onAbort && typeof Promise !== 'undefined') {
      return new Promise((resolve, reject) => {
        this.history.push(location, resolve, reject)
      })
    } else {
      this.history.push(location, onComplete, onAbort)
    }
  }

  /**
   * replace方法
   * @param {*} location
   * @param {*} onComplete
   * @param {*} onAbort
   */
  replace(location: RawLocation, onComplete?: Function, onAbort?: Function) {
    // $flow-disable-line
    if (!onComplete && !onAbort && typeof Promise !== 'undefined') {
      return new Promise((resolve, reject) => {
        this.history.replace(location, resolve, reject)
      })
    } else {
      this.history.replace(location, onComplete, onAbort)
    }
  }

  go(n: number) {
    this.history.go(n)
  }

  back() {
    this.go(-1)
  }

  forward() {
    this.go(1)
  }

  getMatchedComponents(to?: RawLocation | Route): Array<any> {
    const route: any = to ? to.matched ? to : this.resolve(to).route : this.currentRoute
    if (!route) {
      return []
    }
    return [].concat.apply(
      [],
      route.matched.map(m => {
        return Object.keys(m.components).map(key => {
          return m.components[key]
        })
      })
    )
  }

  /**
   * 路由解析
   * @param {*} to 
   * @param {*} current 
   * @param {*} append 
   */
  resolve(
    to: RawLocation,
    current?: Route,
    append?: boolean
  ): {
    location: Location,
    route: Route,
    href: string,
    // for backwards compat
    normalizedTo: Location,
    resolved: Route
  } {
    current = current || this.history.current
    const location = normalizeLocation(to, current, append, this)
    const route = this.match(location, current)
    const fullPath = route.redirectedFrom || route.fullPath
    const base = this.history.base
    const href = createHref(base, fullPath, this.mode) //生成 href 要跳转的路由全路径
    return {
      location,
      route,
      href,
      // for backwards compat
      normalizedTo: location,
      resolved: route
    }
  }

  /**
   * 动态添加路由配置
   * @param {*} routes
   */
  addRoutes(routes: Array<RouteConfig>) {
    this.matcher.addRoutes(routes)
    if (this.history.current !== START) {
      this.history.transitionTo(this.history.getCurrentLocation())
    }
  }
}

/**
 * 注册路由守卫
 * @param {*} list
 * @param {*} fn
 */
function registerHook(list: Array<any>, fn: Function): Function {
  list.push(fn)
  return () => {
    const i = list.indexOf(fn)
    if (i > -1) list.splice(i, 1)
  }
}

/**
 * 创建 href路由跳转路径
 * @param {*} base
 * @param {*} fullPath
 * @param {*} mode
 */
function createHref(base: string, fullPath: string, mode) {
  var path = mode === 'hash' ? '#' + fullPath : fullPath
  return base ? cleanPath(base + '/' + path) : path
}

//将安装该插件(vue-router)的install方法赋给VueRouter中声明的静态方法install，供Vue.use()方法内部调用，来执行插件的安装
VueRouter.install = install
VueRouter.version = '__VERSION__'
//如果是浏览器环境并且window对象上挂载了Vue,则执行自动安装vue-router插件
if (inBrowser && window.Vue) {
  window.Vue.use(VueRouter)
}
