### 前言
如果你在使用 Vue，相信一定会用到 vue-router 这个官方路由管理器，作为 Vue 家族中不可或缺的秀，很有必要来了解下其源码实现，话不多说，走起，去揭开它神秘的面纱吧！

### 源码目录

![](https://user-gold-cdn.xitu.io/2020/3/15/170de5feeee97dd1?w=329&h=798&f=png&s=17121)

上图就是 vue-router 的源码目录，所有的源代码都放在 src 目录下，所以，分析源码的时候也就只需重点关注 src 目录了。同样也附带有栗子，在 examples 目录下，看的时候可以结合栗子来分析。再有就是 vue-router 的源码还是挺复杂的，小弟认为是在 vuex 之上，因此强烈建议采用打 debugger 等 调试方式来分析，否则会很容易走丢（我是谁，我在哪，这里为啥这样写，上一步是什么来着）。亲试有效，很有用。

### 安装插件
#### Vue.use(VueRouter)
大家都知道 Vue 是一个渐进式 JavaScript 框架，Vue 的核心库只关注视图层，其余的能力都是交给了第三方库（插件）来完成的。第三方插件在使用前都需要先进行安装，所以约定都默认暴露一个静态 install 方法，用于在 Vue 里面 安装插件，即注册插件。Vue 是通过对外暴露 Vue.use（plugin）来执行插件安装的。下面贴出插件安装相关的代码，一起来瞅瞅。

```js
<!--Vue 项目中的src/router/index.js-->

import Vue from "vue";
import VueRouter from "vue-router";

Vue.use(VueRouter) //安装插件，use方法内部会调用插件的install方法来执行安装

export default new VueRouter({...})
```

```js
<!--vue源码 src/core/global-api/use.js-->

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
//Vue.use(plugin)方法
  Vue.use = function (plugin: Function | Object) {
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    const args = toArray(arguments, 1)
    args.unshift(this)
     //类型判断后调用插件install方法
    if (typeof plugin.install === 'function') {
    //一般走这里，会看到最终调用插件提供的install静态方法执行插件安装
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      plugin.apply(null, args)
    }
    installedPlugins.push(plugin)
    return this
  }
}

```

#### install()
接下来我们就回到 vue-router 源码中，去看看 install 方法在 VueRouter 中是如何存在的以及它的源代码是如何写的。

经验告诉我们，先找 src 目录下的 index.js 文件，一般都是插件的入口文件，会发现的确有 index.js 文件，立刻点进去。

```js
<!-src/index.js--->

import { install } from './install'

/**
 * VueRouter
 */
export default class VueRouter {
  //声明一个 install 静态方法，安装插件的 install方法会赋给它。
  static install: () => void
}
...

//将安装该插件(vue-router)的install方法赋给VueRouter中声明的静态方法install，
//供Vue.use()方法内部调用，来执行插件的安装
VueRouter.install = install
```
其他暂时不相关代码先去掉，会发现 index.js 中与 install 相关的代码其实就三行，导入 install 方法，在 VueRouter 类中声明一个静态 install 方法，然后将导入的 install 方法挂载给静态 install 方法，有点绕口令的感觉，哈哈，就是这麽一个意思，这里可能有的小伙伴会有疑问，为啥要采用将 install 方法赋给 static install 的这种方式，而不是直接导出呢？因为 vue-router 对外暴露的时候是直接将 VueRouter 这个类导出的，因此需要声明静态方法的方式，你可以去看下 Vuex 源码，它采用的是暴露出一个对象，然后将 Store 类 和 install 方法作为对象的属性导出，这个时候就不会用到声明静态方法这种方式。

那接下来就去 install.js 里面看看，这里面才是 install 方法定义的地方，有料。

```js
<!--src/install.js-->
    
//导入<router-view> 和<router-link>组件
import View from './components/view'
import Link from './components/link'

//声明一个全局变量_Vue,用来保存执行Vue.use(VueRouter)时内部调用install传进来的Vue,
//将其导出的目是别的地方也可以使用，这样可以避免不将 Vue 打包进代码包（不用 import），
//条件下也可以愉快的使用Vue。
export let _Vue
/**
 * 主角登场,货真价实的用来安装vue-router插件的install方法
 * @param {*} Vue 
 */
export function install (Vue) {
  //判断插件是否安装过，如果已经安装过就不能再安装了（只能安装一次）
  if (install.installed && _Vue === Vue) return
  install.installed = true

  //将 Vue保存起来
  _Vue = Vue

 //功能函数：判断 v 是否被定义过
  const isDef = v => v !== undefined

 /**
  * 注册路由实例,全局混入的 beforeCreate 每次执行的时候会调用该方法进行当前路由实例的注册,该方法内部
  * 实际上是调用 registerRouteInstance方法, registerRouteInstance 定义在 <router-view>组件中,
  * 最终是将当前路由实例存入match 对象的instance数组里.
  * @param {*} vm 
  * @param {*} callVal 
  */
  const registerInstance = (vm, callVal) => {
    let i = vm.$options._parentVnode
    if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
      i(vm, callVal) //i(vm,callVal) 等同于 vm.$options._parentVnode.data.registerRouteInstance(vm,callVal)
    }
  }

  // Vuex.mixin 方法会将 beforeCreate ,destroyed 方法使用mergeOptions()合并到Vue.options选项中
  //注意: vue 全局混入 beforeCreate,destroyed 钩子函数，每一个组件初始化时候都会执行，并且执行顺序在组件内部同名钩子函数之前
  Vue.mixin({
    beforeCreate () {
      //如果是vue根实例（通过判断$options.router是否存在，因为只有根实例的options上挂载了router）
      if (isDef(this.$options.router)) {
        //初始化内置属性_routerRoot 指向自己（new Vue()实例）
        this._routerRoot = this 
        //初始化内置属性 _router 保存 router(new VueRouter)实例
        this._router = this.$options.router
        //调用init方法，对router进行初始化
        this._router.init(this)
       //给当前vue根实例定义_route属性,并调用 Vue.util 中的 defineReactive 工具方法将其处理成响应式,其值为history.current
       //history.current 保存的就是当前route(当前被激活的路由)信息,因为<route-view>组件的render函数依赖_route,所以当
       //history.current变更会导致_route变更,然后触发<router-view>组件render函数执行,更新视图
        Vue.util.defineReactive(this, '_route', this._router.history.current)
      } else {
        //否则不是vue根实例，初始化一个_routerRoot内置属性，然后找到其父节点，将其父节点上的_routerRoot引用给当前
        //组件的_routerRoot，这样所有的组件_routerRoot属性都始终指向同一个vue根实例
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
      }
      //注册路由实例,上面刚才定义的registerInstance方法就是在这里调用
      registerInstance(this, this)
    },
    destroyed () {
      //注销路由实例
      registerInstance(this)
    }
  })

  //vue原型上定义$router,我们在组件中可以通过this.$router访问router实例
  Object.defineProperty(Vue.prototype, '$router', {
    get () { return this._routerRoot._router }
  })

  //vue原型上定义$route,我们在组件中可以通过this.$route访问当前被激活的路由
  Object.defineProperty(Vue.prototype, '$route', {
    get () { return this._routerRoot._route }
    
  })

  //将<router-view> 和<rotuer-link>定义为vue中的全局组件
  Vue.component('RouterView', View)
  Vue.component('RouterLink', Link)

  //定义路由钩子函数(组件中的)的合并策略，合并策略跟created钩子函数一样。
  const strats = Vue.config.optionMergeStrategies
  // use the same hook merging strategy for route hooks
  strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created
}

```

总结一下 install 方法做了这麽几件事：
* 声明一个全局变量 _Vue，用于保存传入的 Vue 然后将其暴露出去，供源码中其他地方使用，这样可以在不将 Vue 打包进源码的前提下随心使用 Vue。
* Vue.mixin 全局混入钩子函数（beforeCreate ,destroyed）。

这是插件安装中最最重要的一步。
首先是利用 Vue.mixin 将 beforeCreate 和 destroyed 这两个钩子函数混入到每一个组件中去，这里可以稍微看下 mixin 源码
```js
<!--vue源码 src/core/global-api/minxin.js-->

/* @flow */

//mergeOptions 方法，用于将两个option 对象合并进一个新的option对象中
import { mergeOptions } from '../util/index'

export function initMixin (Vue: GlobalAPI) {
 //mixin 方法，接收一个 Object 类型 mixin 参数
  Vue.mixin = function (mixin: Object) {
    //调用 mergeOptions 将传入的 mixin 对象 合并到 Vue 的 options 上
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
```
会看到 Vue.mixin 中会调用 mergeOptions 这个方法将传入的 mixin 对象通过与 Vue 原有的 options 选项合并成一个新的 option， 然后重新赋给 Vue 的 options 。由于在 Vue 中每个组件的构造函数都会在 extend 阶段合并 Vue.options 到自己的 options 中，这样也就相当于每个组件都定义了 mixin 中定义的选项。所以这也就是通过 Vue.mixin 全局混入的钩子函数会在每一个组件实例初始化的时候被触发调用一次的原因了。

当全局混入的  beforeCreate 被触发的时候首先会通过判断当前 Vue 实例的 `$options` 选项上是否存在 router 路由实例 （`isDef(this.$options.router)`）来确定当前是否是 Vue 根节点，如果是，初始化内置属性 _routerRoot 指向自己（new Vue()实例；初始化内置属性 _router 保存 router(new VueRouter)实例；调用init方法，对router进行初始化（init 方法后面会说到）；
定义 _route 属性并利用 Vue 中的工具方法 defineReactive 将其响应式化（这里为啥要响应式化，谜底后面揭晓）。如果不是 Vue 根节点，则从其父节点上获取到 _routerRoot 属性绑定给自身的 _routerRoot 这样做是保证从 Vue 根节点下来的所有后代组件实例中的 _routerRoot 都指向同一个地方（Vue根节点），最后调用 registerInstance 注册路由实例（该方法后面会讲到）

* Vue 原型上定义 `$router`，用于在组件中可以通过 `this.$router` 访问 router 实例
* Vue原型上定义 `$route`,用于在组件中可以通过 `this.$route` 访问当前被激活的路由
* 将 `<router-view>` 和 `<rotuer-link>` 定义为 Vue 中的全局组件
* 定义路由钩子函数(组件中的)的合并策略，合并策略跟 created 钩子函数一样。

以上就是 install 方法中的所有解析了，其中重要的 init 方法我们在下面的 new VueRouter 实例初始化完成后会讲到，走，继续往下看。

### new VueRouter()

先从项目中 new VueRouter()开始！

```js
import Vue from "vue";
import VueRouter from "vue-router";

Vue.use(VueRouter);//安装

export default new VueRouter({...}) //new 一个 VueRouter 实例

```
然后再到定义 VueRouter 类的源代码 index.js 文件中去。是这样的，我先将 index.js 所有源码贴出来，虽然挺多的，但是不要慌，这样做纯粹为了仪式感。过程分析还是会采用分步骤的拆解方式的。

```js
<!-vue-router源码 src/index.js--->

/**
 * VueRouter
 */
export default class VueRouter {
  //声明一个 install 静态方法，安装插件的 install方法会赋给它，下面会看到。
  static install: () => void
  static version: string
  constructor(options: RouterOptions = {}) {
    this.app = null //表示vue根实例
    this.apps = [] // 保存拥有$options.router 属性的 Vue 实例,一般也就是vue根实例 [app]
    this.options = options //new VueRoter()时候传入的options路由配置
    this.beforeHooks = [] //保存beforeEach路由钩子
    this.resolveHooks = [] //保存beforeResolve路由钩子
    this.afterHooks = [] //保存afterEach路由钩子
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
   */
  beforeEach(fn: Function): Function {
    return registerHook(this.beforeHooks, fn)
  }

  /**
   * 注册 beforeResolve 路由钩子函数
   */
  beforeResolve(fn: Function): Function {
    return registerHook(this.resolveHooks, fn)
  }

  /**
   * 注册 afterEach 路由钩子函数
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
   */
  resolve(
    to: RawLocation,
    current?: Route,
    append?: boolean
  ) {
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
   */
  addRoutes(routes: Array<RouteConfig>) {
    this.matcher.addRoutes(routes)
    if (this.history.current !== START) {
      this.history.transitionTo(this.history.getCurrentLocation())
    }
  }
}

/**
 * 注册钩子函数
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

```

index.js 文件就是我们在项目中采用 `import VueRouter from 'vue-router'` 导入的 vue-router 入口文件其实导出的东西就是 VueRouter 这个类。index.js 文件中首先是定义了 vue-router 核心 VueRouter 类，然后是定义了一个注册路由钩子函数的方法和一个创建 href路由跳转路径的方法，下来是将 install 方法挂载给 VueRouter 类的静态 install 方法，最后是一个判断当前运行的浏览器环境的 window 对象上如果挂载了 Vue ,则执行自动安装 vue-router 插件，也就是说只要 `import VueRouter from 'vue-router'`一执行，上面这些事就会被完成。分析完入口文件被加载时所做的事情后，我们来分析 VueRouter 的实例初始化过程

#### VueRouter 
```js
<!--src/index.js-->
...
class VueRouter {
    ...
    constructor(options: RouterOptions = {}) {
        this.app = null //表示vue根实例
        this.apps = [] // 保存拥有$options.router 属性的 Vue 实例,一般也就是vue根实例 [app]
        this.options = options //new VueRoter()时候传入的options路由配置
        this.beforeHooks = [] //保存beforeEach路由钩子
        this.resolveHooks = [] //保存beforeResolve路由钩子
        this.afterHooks = [] //保存afterEach路由钩子
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
      ...
}
 
```
首先执行 VueRouter 类的 constructor 构造函数，会看到先初始化了一些内置变量，然后调用 createMatcher 路由匹配器函数，下来是根据项目中路由配置传入的 mode 来确定路由 模式（会判断浏览器对 history 模式的兼容性） 从而初始化对应模式下的 history 实例，这就是 VueRouter 构造函数做的事情。下来我们到 createMatcher中去，看看这个路由匹配器做了哪些事。

#### createMatcher

```js
<!--src/create-matcher.js-->

...

/**
 * 路由匹配器函数
 */
export function createMatcher (
  routes: Array<RouteConfig>, //new VueRoute()时传入的路由配置中的routes
  router: VueRouter //router实例对象
){
  //创建路由映射表,这张表是一个对象,内部包含 pathList:保存所有路径,pathMap:保存路径到 RouteRecord 的映射关系
  //nameMap: 保存 name到RouteRecord的映射关系
  const { pathList, pathMap, nameMap } = createRouteMap(routes)
  ...
}
...
```
其余代码先去掉，都是一些提前定义好的后面路由匹配时调用的方法，后面用到再拿出来说，否则容易让人发晕。会发现 new VueRouter 初始化时候 createMatcher 其实内部就 调用了一个 createRouteMap 方法，这个方法是干嘛的呢，从名字我们就可以猜个差不多，是用来创建路由映射表的一个函数，那辗转又去 createRouteMap 里面吧。

#### createRouteMap 
```js
<!--src/create-route-map.js-->
...

/**
 * 创建路由映射表(用户路由配置->路由映射表)
 */
export function createRouteMap (
  routes: Array<RouteConfig>, //new VueRoute()时传入的路由配置中的routes
  oldPathList?: Array<string>,
  oldPathMap?: Dictionary<RouteRecord>,
  oldNameMap?: Dictionary<RouteRecord>
) {
  // the path list is used to control path matching priority
  //保存所有path,(路径列表用于控制路径匹配优先级,前面的会先匹配,后面会看到是如何的存放顺序)
  const pathList: Array<string> = oldPathList || []
  // $flow-disable-line
  //对象,用key,value的形式保存path跟RouteRecord的映射关系 {paht: routeRecord}
  const pathMap: Dictionary<RouteRecord> = oldPathMap || Object.create(null)
  // $flow-disable-line
  //对象,用key,value的形式保存name跟RouteRecord的映射关系 {name: routeRecord}
  const nameMap: Dictionary<RouteRecord> = oldNameMap || Object.create(null)

  //遍历routes,拿到每一个route调用addRouteRecord()生成一条routeRecode记录,并对应添加进pathList,pathMap,nameMap中
  routes.forEach(route => {
    addRouteRecord(pathList, pathMap, nameMap, route)
  })

  // ensure wildcard routes are always at the end
  //如果path中路径通配符* 项,则将其放到最后,因为pathList是有匹配优先级的(这也就是我们在使用vue-router时候,为啥* 选项总是作为路由匹配终
  //选择项,只有路由匹配不到的时候才会匹配*)
  for (let i = 0, l = pathList.length; i < l; i++) {
    if (pathList[i] === '*') {
      pathList.push(pathList.splice(i, 1)[0])
      l--
      i--
    }
  }

  if (process.env.NODE_ENV === 'development') {
    // warn if routes do not include leading slashes
    //如果路由不包含前导斜杠，则发出警告
    const found = pathList
    // check for missing leading slash
      .filter(path => path && path.charAt(0) !== '*' && path.charAt(0) !== '/')

    if (found.length > 0) {
      const pathNames = found.map(path => `- ${path}`).join('\n')
      warn(false, `Non-nested routes must include a leading slash character. Fix the following routes: \n${pathNames}`)
    }
  }
 //返回一个包含 pathList,pathMap,nameMap的对象,这也就是我们在new VueRouter的时候传入的路由配置里的routes会被转换成这样的格式,
 //称为路由映射表
  return {
    pathList,
    pathMap,
    nameMap
  }
}
```
createRouteMap 方法的功能就是将我们在项目中传入的路由配置（即 new VueRouter({routes,...})中的 routes ）转换成路由映射表,该方法会返回一个对象，对象中包含三个属性，pathList 保存所有的 path； pathMap 保存每个 path 到 RouteRecord 的映射关系；nameMap 保存每个 name 到 RouteRecord 的关系。当然这是结果，作为一个有节操的码农，怎么可能放过其中间环节呢？

首先是定义了这三个变量，然后遍历传入的 routes 拿到每一个 route 调用 addRouteRecord 方法创建一条 routeRecode 记录,routeRecode 方法中会将这条记录添加进 pathList,pathMap,nameMap 中，最后会遍历 pathList 数组 判断是否含有中通配符 `*` 项，如果有则将通配符 `*` 移到 pathList 末尾，这也就是我们在使用 vue-router 时候,为啥 `*` 选项总是作为路由匹配终选择项,只有路由匹配不到的时候才会匹配 * 的原因。以上可以看出 addRouteRecord 是创建路由映射表过程中最关键方法。

```js
<!--src/create-route-map.js-->

...
  /**
   * 添加路由记录,这个方法就是把用户路由配置转换成路由映射表的执行者
   */
  function addRouteRecord (
    pathList: Array<string>,
    pathMap: Dictionary<RouteRecord>,
    nameMap: Dictionary<RouteRecord>,
    route: RouteConfig,
    parent?: RouteRecord,
    matchAs?: string
  ) {
    //从route中取出path,name
    const { path, name } = route
    if (process.env.NODE_ENV !== 'production') {
      //路由配置中path为必选项配置,定义配置的时候如果不定义path,会报错
      assert(path != null, `"path" is required in a route configuration.`)
      //路由组件不能是字符串,否则会报错
      assert(
        typeof route.component !== 'string',
        `route config "component" for path: ${String(
          path || name
        )} cannot be a ` + `string id. Use an actual component instead.`
      )
    }
    //定义编译正则的选项,一般不用
    const pathToRegexpOptions: PathToRegexpOptions =
      route.pathToRegexpOptions || {}
      //规范化路径,如果当前是children的话,children中的path,会拼接在parent path后面,例如: '/foo/bar'
    const normalizedPath = normalizePath(path, parent, pathToRegexpOptions.strict)
    //caseSensitive 匹配规则是否大小写敏感,一般不用
    if (typeof route.caseSensitive === 'boolean') {
      pathToRegexpOptions.sensitive = route.caseSensitive
    }
  
    //将 route 转换成 routeRecord(创建routeRecord)
    const record: RouteRecord = {
      path: normalizedPath,// 注意这里的path,是根据parent的path转换后的路径,  
      regex: compileRouteRegex(normalizedPath, pathToRegexpOptions), //匹配path路径的路径正则表达式扩展,match方法进行路由匹配的时候用这个表达式匹配路由.
      components: route.components || { default: route.component },//保存用户路由配置时候的component,不过这里会稍微进行转换成{default:route.component}
      instances: {},//组件实例
      name,//当前route名称
      parent,//父routeRecord
      matchAs,
      redirect: route.redirect,//重定向路径redirect
      beforeEnter: route.beforeEnter,//beforeEnter路由配置钩子
      meta: route.meta || {},//meta
      props: //props
        route.props == null
          ? {}
          : route.components
            ? route.props
            : { default: route.props }
    }
    
    //如果当前route有children,则循环遍历children,拿到每一个childRoute递归调用addRouteRecord方法.
    //注意,此时会将当前recode作为parent传入addRouteRecord
    if (route.children) {
      // Warn if route is named, does not redirect and has a default child route.
      // If users navigate to this route by name, the default child will
      // not be rendered (GH Issue #629)
      if (process.env.NODE_ENV !== 'production') {
        if (
          route.name &&
          !route.redirect &&
          route.children.some(child => /^\/?$/.test(child.path))
        ) {
          warn(
            false,
            `Named Route '${route.name}' has a default child route. ` +
              `When navigating to this named route (:to="{name: '${
                route.name
              }'"), ` +
              `the default child route will not be rendered. Remove the name from ` +
              `this route and use the name of the default child route for named ` +
              `links instead.`
          )
        }
      }
      //遍历children,递归调用addRouteRecord,此时会将当前record(即routeRecord)作为parent参数传入该方法
      route.children.forEach(child => {
        const childMatchAs = matchAs
          ? cleanPath(`${matchAs}/${child.path}`)
          : undefined
        addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs)
      })
    }

    //pathMap中添加一条path到RouteRecord的映射记录
    if (!pathMap[record.path]) {
      pathList.push(record.path)
      pathMap[record.path] = record
    }

    //如果alias存在则调用addRouteRecord生成path 为alias的routeRecode记录,执行流程跟上面一样.
    if (route.alias !== undefined) {
      const aliases = Array.isArray(route.alias) ? route.alias : [route.alias]
      for (let i = 0; i < aliases.length; ++i) {
        const alias = aliases[i]
        if (process.env.NODE_ENV !== 'production' && alias === path) {
          warn(
            false,
            `Found an alias with the same value as the path: "${path}". You have to remove that alias. It will be ignored in development.`
          )
          // skip in dev to make it work
          continue
        }

        const aliasRoute = {
          path: alias,
          children: route.children
        }
        addRouteRecord(
          pathList,
          pathMap,
          nameMap,
          aliasRoute,
          parent,
          record.path || '/'
        )
      }
    }

    //nameMap中添加一条记录name到RouteRecord的映射记录
    if (name) {
      if (!nameMap[name]) {
        nameMap[name] = record
      } else if (process.env.NODE_ENV !== 'production' && !matchAs) {
        warn(
          false,
          `Duplicate named routes definition: ` +
            `{ name: "${name}", path: "${record.path}" }`
        )
      }
    }
  }
```

addRouteRecord 方法的功能就是添加路由记录,这个方法就是把用户路由配置转换成路由映射表的真正执行者。方法内首先会创建一个 RouteRecord 对象（每个route 都会生成这样一个对象，这里就是 将用户路由配置转换的第一步），RouteRecord 对象中的属性需要注意几个点：
* path 是规范化后的路径（是根据 parent 的 path 转换后的路径,  如果当前是 children 的话,children 中的 path,会拼接在 parent path 后面,例如: '/foo/bar'）
* regex 是一个匹配 path 路径的路径正则表达式扩展,match 方法进行路由匹配的时候用这个表达式匹配路由
* components 是用来保存我们项目中路由配置中的 component,不过这里会稍微进行转换成 {default:route.component}

其余属性可以看代码片段中的注释。

然后判断当前 route 是否配置有 children 属性，如果有，就循环遍历 children,拿到每一个 childRoute 递归调用 addRouteRecord 方法.这时要注意,此时会将当前 recode 作为 parent 传入 addRouteRecord，这样一来具有父子关系的 route 都会被记录进 pathList、pathMap、nameMap 中。

下来为 pathMap 中添加一条 pat h到 RouteRecord 的映射记录。

最后通过判断当前 route 是否配置 name 来决定是否为 nameMap 中添加一条记录 name 到 RouteRecord 的映射记录。

> TODO：如果当前 route 配置中 有 alias 属性，则会调用 addRouteRecord 生成 path 为 alias 的 routeRecode 记录,执行流程跟上面一样，因为不太常用，所以我们就一笔带过了。

经过这样一番流程下来我们在项目中传入的路由配置 routes 就会被转换成一张从 `用户路由配置` 到用 pathList、pathMap 和 nameMap 记录的 `路由映射表`喽。

分析完了 createRouteMap 方法，我们返回 createMatcher 方法中，会看到该方法返回一个包含 match 和 addRoutes 属性的对象，addRoutes 方法 是一个动态添加路由的方法,所以我们可以在外部通过该方法动态添加路由配置,其内部会调用 createRouteMap 方法往路由映射表里添加传入的 routes对应的 RouteRecord 并将对应关系记录进 pathList,pathMap,nameMap 中。math 方法是用来执行路由匹配的,会根据 raw （就是我们使用push/replace方法的第一个参数）和 currentRoute （当前路由信息）,计算匹配出一个新的路由route （最终态的route）。

```js
<!--src/create-matcher.js-->

  /**
   * 动态添加路由,所以我们可以在外部通过该方法动态添加路由配置,然后会调用createRouteMap方法往路由映射表里添加传入的routes对应的 RouteRecord并将
   * 对应关系记录进pathList,pathMap,nameMap中
   */
  function addRoutes (routes) {
    createRouteMap(routes, pathList, pathMap, nameMap)
  }

  /**
   * 执行路由匹配,会根据 raw:导航去哪的路由信息(就是我们使用push/replace方法的第一个参数) 和currentRoute:当前路由信息,计算匹配出一个新的路径
   */
  function match (
    raw: RawLocation,//导航去哪的路由信息(就是我们使用push/replace方法的第一个参数)
    currentRoute?: Route,//当前激活态路由线路的信息(可以理解成就是$route)
    redirectedFrom?: Location
  ): Route {
    //规范化location,根据raw(this.$router.push/replace的第一个参数)和当前route计算出一个新的location
    const location = normalizeLocation(raw, currentRoute, false, router)
    const { name } = location
    
    //如果name存在,根据name从nameMap[name]找到对应的routeRecord,最终调用createRoute方法创建一个新的route对象(这个route对象就是最终的route)
    if (name) {
      //从nameMap中取出name对应的routeRecord
      const record = nameMap[name]
      //如果没有匹配到该name对应的routeRecord,警告提示
      if (process.env.NODE_ENV !== 'production') {
        warn(record, `Route with name '${name}' does not exist`)
      }
      //没有匹配到routeRecord,通过location创建一个新的route返回
      if (!record) return _createRoute(null, location)
      //遍历当前routeRecord的regex路由正则扩展中的keys得到一个paramNames数组
      const paramNames = record.regex.keys
        .filter(key => !key.optional)
        .map(key => key.name)
      
      if (typeof location.params !== 'object') {
        location.params = {}
      }
      
      if (currentRoute && typeof currentRoute.params === 'object') {
        for (const key in currentRoute.params) {
          if (!(key in location.params) && paramNames.indexOf(key) > -1) {
            location.params[key] = currentRoute.params[key]
          }
        }
      }
     //将params参数填充进record.path中生成新的path给location
      location.path = fillParams(record.path, location.params, `named route "${name}"`)
      //_createRoute方法内部调用createRoute返回一个由匹配到的record跟lacation结合生成的新route对象(最终态route对象)
      return _createRoute(record, location, redirectedFrom)

      //如果name属性不存在,则判断path
    } else if (location.path) {
      location.params = {}
      //这里可能会有个疑问,为啥不像name一样直接去pathMap中匹配呢,而是遍历pathList然后去找
      //原因是我们传入的locatiion.path是真实的路径,而pathMap中定义的path是包含参数标识符的,因此直接去匹配有可能匹配不到
      for (let i = 0; i < pathList.length; i++) {
        const path = pathList[i]
        const record = pathMap[path]
        //如果匹配到routeRouteRecord,调用_createRoute方法创建新的route
        if (matchRoute(record.regex, location.path, location.params)) {
          return _createRoute(record, location, redirectedFrom)
        }
      }
    }
    // no match
    return _createRoute(null, location)
  }

```

然后我们再返回到 index.js 中 VueRouter 类的构造函数中继续往下分析

```js
<!--src/index.js-->
...
  class VueRouter {
      ...
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
    ...
  }
    
```
#### new HTML5History()

下来就是根据 mode 选择初始化对应的 history 实例了，这里我们就只分析下 mode 为 history 模式这种情况吧，hash 模式可以看我的仓库源代码注释，都是比较详细的。

```js
<!--src/history/html5.js-->
...
class HTML5History extends History {
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
}
...
```
只要是类，初始化就看构造函数执行，其余都先不管，会看到 HTML5History 类是继承自 History 基类，然后在构造函数中先是初始化了一些跟滚动有关的属性，下来在 window 上设置了 popstate 事件，用来监听浏览器活动。注意构造函数中的 super，看到它我们就必须去趟父类中。

```js
<!--src/history/base.js-->
...
class History {
    ...
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
}
...
```
History 基类的构造函数先将 router (new VueRouter) 实例挂载到 history 实例上，然后对 base 进行规范化（如果未配置则给默认值:'/'），下来初始化一个原始 current 对象（初始化current),这里的 current 初始值 是通过 `START` 产生的，`START` 其实是 createRoute 方法用 `path = '/'`创建的一个 route 对象，也被称为原始 route 对象，这样 current 就拿到了项目初始化（项目启动）时最原始的 route 路由对象，最后初始化了一些内置属性。

至此 history 实例就初始化完成啦，后面就可以愉快的时候其内部的属性和方法喽。

那到这里 new VueRouter() 初始化一个 VueRouter 实例的工作也就完成了。然后会将其作为option 选项传入 new Vue({...}) 中伴随着 Vue 根实例的初始化，被挂载到根实例的 $options 上，new Vue 实例初始化完成后就会执行渲染（app.vue），全局混入的 beforeCreate 方法被触发，此时应该有音乐响起，因为终于可以转场去执行 init()方法啦。

### init

```js
<!--src/index.js-->

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

```

init 方法是用来初始化路由的，首先会将传入的 app（Vue根实例）存入 apps 数组中,然后将 Vue 根实例挂载到 router 实例的 app 属性上（只有Vue 根实例有此待遇被挂载到 app实例和保存到 apps数组中）最后通过 `this.history` 根据不同路由模式选择执行不同逻辑，这里我们就继续走 history 模式这条路线，会看到 if 判断内部通过调用 `transitionTo` 方法来开启路由过渡（路由切换）。

### transitionTo 

```js
<!--src/history/base.js-->

class History {
    ...
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
}
```
transitionTo 方法首先会调用 VueRouter 类中定义的 match方法（该 match 内部最终会调用 matcher 路由匹配器中的 match 方法）去根据目标 location 和当前 current 计算产生一个规范化后的新 location，然后根据新 location 匹配 routeRecord 生成新的 rotue (最终态route,this.$route就是这个route)。

```js
<!--src/index.js-->

class VueRouter {
    ...
     /**
   * 执行路由匹配,会根据 raw:导航去哪的路由信息(就是我们使用push/replace方法的第一个参数) 和current:当前路由信息,计算匹配出一个新的route
   * 这个新的route就是最终的route(this.$route访问到的)
   */
  match(
    raw: RawLocation, //push方法的第一个参数(要去的路由)
    current?: Route, //当前路由信息(对象)
    redirectedFrom?: Location
  ): Route {
    //返回
    return this.matcher.match(raw, current, redirectedFrom)
  }
}
```
#### match 

```js
<!--src/create-matcher.js-->

  /**
   * 执行路由匹配,会根据 raw:导航去哪的路由信息(就是我们使用push/replace方法的第一个参数) 和currentRoute:当前路由信息,计算匹配出一个新的路径
   */
  function match (
    raw: RawLocation,//导航去哪的路由信息(就是我们使用push/replace方法的第一个参数)
    currentRoute?: Route,//当前激活态路由线路的信息(可以理解成就是$route)
    redirectedFrom?: Location
  ): Route {
    //规范化location,根据raw(this.$router.push/replace的第一个参数)和当前route计算出一个新的location
    const location = normalizeLocation(raw, currentRoute, false, router)
    const { name } = location
    
    //如果name存在,根据name从nameMap[name]找到对应的routeRecord,最终调用createRoute方法创建一个新的route对象(这个route对象就是最终的route)
    if (name) {
      //从nameMap中取出name对应的routeRecord
      const record = nameMap[name]
      //如果没有匹配到该name对应的routeRecord,警告提示
      if (process.env.NODE_ENV !== 'production') {
        warn(record, `Route with name '${name}' does not exist`)
      }
      //没有匹配到routeRecord,通过location创建一个新的route返回
      if (!record) return _createRoute(null, location)
      //遍历当前routeRecord的regex路由正则扩展中的keys得到一个paramNames数组
      const paramNames = record.regex.keys
        .filter(key => !key.optional)
        .map(key => key.name)
      
      if (typeof location.params !== 'object') {
        location.params = {}
      }
      
      if (currentRoute && typeof currentRoute.params === 'object') {
        for (const key in currentRoute.params) {
          if (!(key in location.params) && paramNames.indexOf(key) > -1) {
            location.params[key] = currentRoute.params[key]
          }
        }
      }
     //将params参数填充进record.path中生成新的path给location
      location.path = fillParams(record.path, location.params, `named route "${name}"`)
      //_createRoute方法内部调用createRoute返回一个由匹配到的record跟lacation结合生成的新route对象(最终态route对象)
      return _createRoute(record, location, redirectedFrom)

      //如果name属性不存在,则判断path
    } else if (location.path) {
      location.params = {}
      //这里可能会有个疑问,为啥不像name一样直接去pathMap中匹配呢,而是遍历pathList然后去找
      //原因是我们传入的locatiion.path是真实的路径,而pathMap中定义的path是包含参数标识符的,因此直接去匹配有可能匹配不到
      for (let i = 0; i < pathList.length; i++) {
        const path = pathList[i]
        const record = pathMap[path]
        //如果匹配到routeRouteRecord,调用_createRoute方法创建新的route
        if (matchRoute(record.regex, location.path, location.params)) {
          return _createRoute(record, location, redirectedFrom)
        }
      }
    }
    // no match
    return _createRoute(null, location)
  }
```

matcher 路由匹配器中的 match 函数首先根据传入的目标 location 和当前 current 调用 normalizeLocation 方法计算生成一个规范后的新 location，然后对 name 判断如果 name 存在,根据 name 从 nameMap[name] 找到对应的 routeRecord,最终调用 createRoute 方法创建一个新的 route 对象(这个route对象就是最终的route)，如果 name 属性不存在,则判断 path，然后遍历 pathList 每次拿到 path 和从 pathMap[path]获取到 record 调用 matchRoute 去匹配 routeRouteRecord，如果匹配到了也最终调用 createRoute 方法创建一个新的 route 对象
> 这里小伙伴可能会有个疑问，为啥 path 不能像 name 一样直接去 pathMap 中匹配呢，而是先遍历 pathList 获取到 path 然后拿到 pathMap[path] 再调用 matchRoute 利用 record.regex 去匹配 routeRouteRecord呢？原因是我们传入的 locatiion.path 是真实的路径，而 pathMap 中定义的 path 是包含参数标识符的，因此直接去匹配有可能匹配不到。

#### createRoute

```js
<!--src/create-matcher.js-->

 /**
   * 创建route
   */
  function _createRoute (
    record: ?RouteRecord,
    location: Location,
    redirectedFrom?: Location
  ): Route {
    //走redirect匹配逻辑
    if (record && record.redirect) {
      return redirect(record, redirectedFrom || location)
    }
    //走alias匹配逻辑
    if (record && record.matchAs) {
      return alias(record, location, record.matchAs)
    }
    //调用createRoute方法去创建新的route(最终态的route,使用this.$route获取到的route就是这里生成的)
    return createRoute(record, location, redirectedFrom, router)
  }

```

```js
<!--src/util/route.js-->

/**
 * 创建一个新的不可被修改的新route(这里就是最终的route,组件中使用this.$route获取的route就是这里生成的,不信去打印看看)
 */
export function createRoute (
  record: ?RouteRecord,
  location: Location,
  redirectedFrom?: ?Location,
  router?: VueRouter
): Route {
  const stringifyQuery = router && router.options.stringifyQuery

  let query: any = location.query || {}
  try {
    query = clone(query)
  } catch (e) {}
  //由location和record结合生成的新的route对象
  const route: Route = {
    name: location.name || (record && record.name),
    meta: (record && record.meta) || {},
    path: location.path || '/',
    hash: location.hash || '',
    query,
    params: location.params || {},
    fullPath: getFullPath(location, stringifyQuery), //location.path + query + hash
    matched: record ? formatMatch(record) : [] //收集当前record线上所有routeRecord进一个数组 [..,'parentRecord','childRecord']
  }
  //重定向
  if (redirectedFrom) {
    route.redirectedFrom = getFullPath(redirectedFrom, stringifyQuery)
  }
  //返回被freeze后的新route对象,这就是为什么组件中this.$route获取到的当前激活态路由record是不可更改的原因
  return Object.freeze(route)
}
```
_createRoute 方法中的 redirect 和 alias 情况在这里就不分析了，其实最终还是调用 _createRoute ，只不过多了一些中间逻辑，跳过它们，直接分析创建 route ,会发现 其实最终调用 createRoute 方法来完成最终态的route 创建。

createRoute 方法中需要明确几点，首先是在 vue-router 中 所有的最终态 route 均由 createRoute 创建，其次是 由 location 和 record 结合生成的新 route 对象是不可更改的（`Object.freeze(route)`），最后一点（也是最重要一点）是生成的 route 对象中有个 matched 属性，类型是数组，会保存当前路由路径匹配到的所有 routeRecord， `<router-view>` 渲染组件的时候就是从这个 matched 数组里面直接取目标 record 中的 component 来渲染，因此，特别滴重要！matched 属性是通过调用 formatMatch 方法生成的。

```js
<!--src/util/route.js-->

/**
 * 从当前RouteRecord开始循环往上找parent,直到最外层(循环结束),每一次循环都会将当前record记录进一个数组中['parentRecord','childRecord']
 * 这样就将当前record线上所有record收集了起来(matched中的record就是这里收集的,因此叫formatMatch)
 * @param {*} record 
 */
function formatMatch (record: ?RouteRecord): Array<RouteRecord> {
  const res = []
  while (record) {
    res.unshift(record)
    record = record.parent
  }
  return res
}
```
formatMatch 方法会从当前 routeRecord 开始循环往上找 parent, 直到最外层(循环结束),每一次循环都会将当前 record 记录进一个数组中 （['parentRecord','childRecord']）这样就将当前 record 线上所有 record 收集了起来（matched中的 record 就是这里收集的,因此叫 formatMatch）

以上就是创建最终态 route 的逻辑，然后我们返回到 transitionTo 方法中，继续往下看。
下来就是调用 confirmTransition 方法，该方法会执行真正的路由切换，最最重要，请一定要记住它。

### confirmTransition

```js
<!--src/history/base.js-->

class History {
    ...
    
  /**
   * 确认路由过渡:最重要的方法,该方法内会真正的执行路由切换
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
   
    //导航被确认后要解析的对列（是一个数组）
    const queue: Array<?NavigationGuard> = [].concat(
      // in-component leave guards
      //提取deactivated数组中所有失活组件的beforeRouteLeave(离开守卫)
      extractLeaveGuards(deactivated),
      // global before hooks
      //全局的beforeEach钩子函数
      this.router.beforeHooks,
      // in-component update hooks
      //提取updated中所有可复用的组件中的beforeRouteUpdate 守卫 
      extractUpdateHooks(updated),
      // in-config enter guards
      //提取到actived数组中将要激活的路由配置中定义的 beforeEnter 守卫。
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
         //hook就是当前要执行的守卫,你看标准的hook(to,from,next)格式,是不是很熟悉呀。
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
            //执行 step(index + 1),让循环继续执行，这就是为啥守卫中一定要写next()才可以继续向下执行下一个守卫的原因
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
        //提取到actived数组中所有将要激活组件的beforeRouteEnter 守卫
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
}
...
```
confirmTransition 方法中首先会获取到当前激活态路由对象 current，然后定义了一个阻断路由跳转的函数  abort ，下来是判断如果目标 route 跟当前 current 完全相同,则阻断路由跳转。再下来调用 resolveQueue 方法，这个方法称为解析队列,会对 `this.current.matched`, `route.matched`中的 routRecord 遍历一一对比,提取出 updated(目标 route 和将要失活的current 路由对象中相同 routeRecord ), deactivated( current 中将要失活的 routeRecord ),activated( 目标 route 中 即将激活的 routeRecord )

#### resolveQueue

```js
<!--src/history/base.js-->

/**
 * 解析队列,通过遍历对比current.matched和route.matched数组的routRecord,得到updated,activated,deactivated然后返回
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
```
 
解析出 updated，activated，deactivated 3个 ReouteRecord 数组后，定义一个 queue 路由对列，其类型是一个数组，存放用于导航解析过程中要执行的导航守卫数组和异步路由组件解析方法。

#### queue

```js
<!--src/history/base.js-->

    //路由对列，类型为数组
    const queue: Array<?NavigationGuard> = [].concat(
      // in-component leave guards
      //提取deactivated数组中所有失活组件的beforeRouteLeave(离开守卫)
      extractLeaveGuards(deactivated),
      // global before hooks
      //全局的beforeEach 守卫
      this.router.beforeHooks,
      // in-component update hooks
      //提取updated中所有可复用的组件中的beforeRouteUpdate 守卫
      extractUpdateHooks(updated),
      // in-config enter guards
      //提取到actived数组中将要激活的路由配置中定义的 beforeEnter 守卫。
      activated.map(m => m.beforeEnter),
      // async components
      //解析activated数组中所有routeRecord里的异步路由组件
      resolveAsyncComponents(activated)
    )
```

首先是执行 extractLeaveGuards 方法提取出 deactivated 数组中所有将要失活组件的 beforeRouteLeave (离开守卫)

```js

<!--src/history/base.js-->

/**
 * 提取所有将要失活组件中定义的 beforeRouteLeave 守卫。
 */
function extractLeaveGuards (deactivated: Array<RouteRecord>): Array<?Function> {
  return extractGuards(deactivated, 'beforeRouteLeave', bindGuard, true)
}
```
extractLeaveGuards 方法内部会调用 extractGuards 。

```js
<!--src/history/base.js-->

/**
 * 提取 RouteRecord 中指定 name 的守卫
 */
function extractGuards (
  records: Array<RouteRecord>,
  name: string,
  bind: Function,
  reverse?: boolean
): Array<?Function> {
  //guards 是一个 '给instance绑定指定守卫' 的函数，或函数数组
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
``` 

extractGuards 是一个可以提取出各个阶段路由守卫的通用方法，其内部首先通过调用 flatMapComponents 方法得到一个给 instance（组件实例）绑定指定 name 守卫 的函数或函数数组 guards，（其实是将 instance 作为执行上下文绑定到守卫上，这里为了好描述，就直接说成绑定守卫给 instance ）。其中 flatMapComponents 是在 fn 函数（第二个参数）中调用 extractGuard 获取到 records 数组中 routeRecord 下的所有组件里面指定 name 的守卫 guard，guard 就是 guards 数组中的元素。然后再将 guards 经过 flatten
 方法处理后从二维数组变成一维数组，最终返回一个各元素为 boundRouteGuard 函数的一维数组， 在后面这个数组被迭代执行后，boundRouteGuard 函数就会被调用，然后收集的守卫就会被触发。在这里我们就是通过这种方式提取出 deactivated 数组中所有即将失活组件里的 beforeRouteLeave 守卫，将其收集进 queue 队列里。
 
 ```js
 <!--src/util/resolve-components.js-->
 
 /**
 * 通过调用flatten方法将matched(records)数组中的每一个routRecord返回的给instances绑定guard守卫的二维数组平整为一维数组
 * 简单讲就是返回一个功能为给instance绑定指定名称守卫的一维数组
 */
export function flatMapComponents (
  matched: Array<RouteRecord>,//records
  fn: Function
): Array<?Function> {
  return flatten(matched.map(m => { //matched.map 返回 [[fn,fn,fn],[fn,fn,fn]],flatten方法将其平整为[fn,fn,fn,fn,fn,fn]
    return Object.keys(m.components).map(key => fn(
      m.components[key],
      m.instances[key],
      m, key
    ))
  }))
}


/**
 * 获取def 组件中 指定名称的守卫
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

 ``` 
 
 ```js
  <!--src/util/resolve-components.js-->
  
 /**
 * 将二维数组平整为一维数组,这里传入的arr参数格式为: [[fn,fn,fn],[fn,fn,fn]] 
 * Array.prototype.concat.apply([], arr)会将其平整为[fn,fn,fn,fn,fn,fn]的形式
 */
export function flatten (arr: Array<any>): Array<any> {
  return Array.prototype.concat.apply([], arr)
}
 ```
 
 以上步骤对应 queue 里面提取 deactivated 数组中所有即将失活组件的 beforeRouteLeave (离开守卫)，
 下来是提取全局的 beforeEach 守卫，通过 ` this.router.beforeHooks`方式
 
 ```js
 <!--src/index.js-->
 
 class VueRouter {
    ...
    constructor() {
        this.beforeHooks = [] //保存beforeEach路由钩子
    }
  
 }
 ```
 
 回到 index.js 里面的 VueRouter 类中，会发现开始定义了一个类型为数组的 beforeHooks 属性，这个属性就是用来保存我们在 Vue 项目中注册的全局 beforeEach 守卫。
 
 ```js
 <!-vue项目中 src/router/index.js--->
 
import Vue from "vue";
import VueRouter from "vue-router";

Vue.use(Router);

const router = new VueRouter({...})

//注册beforeEach全局路由守卫
router.beforeEach((to,from,next)=> {
 ...
  next();
})
 
 ```
 beforeEach 方法内部会调用 registerHook 执行注册
 
 ```js
 <!--src/index.js-->
 
  class VueRouter {
      ...
        /**
        * 注册 beforeEach 路由钩子函数
        */
      beforeEach(fn: Function): Function {
        return registerHook(this.beforeHooks, fn)
      }

  }
  
 /**
 * 注册路由守卫
 */
function registerHook(list: Array<any>, fn: Function): Function {
  list.push(fn)
  return () => {
    const i = list.indexOf(fn)
    if (i > -1) list.splice(i, 1)
  }
}
 ```
 registerHook 是一个注册守卫的通用方法，只要调用就会把传入的 fn 钩子函数 push 进传入的list 数组，这里就是将 fn 钩子函数 push 进 beforeHooks 数组里（同时 registerHook  会返回一个注销当前路由守卫的函数）。然后我们就可以通过 this.router.beforeHooks 的方式获取到项目中注册的全局  beforeEach 守卫。
 
提取完全局的 beforeEach 守卫后下来是提取 updated 中所有可复用的组件中的 beforeRouteUpdate 守卫，这里跟第一步中提取 beforeRouteLeave 方式类似，就不再赘述。

下来是提取 actived 数组中将要激活的路由配置中定义的 beforeEnter 守卫。

```js

 //提取 actived 数组中将要激活的路由配置中定义的 beforeEnter 守卫。
activated.map(m => m.beforeEnter)

```
最后一步是解析 activated 数组中所有 routeRecord 里的异步路由组件，是调用 resolveAsyncComponents 方法执行解析的。

```js
<!--src/history/base.js-->

 resolveAsyncComponents(activated)
 
```

```js
<!--src/util/resolve-components-->

/**
 * 解析异步路由组件
 */
export function resolveAsyncComponents (matched: Array<RouteRecord>): Function {
  return (to, from, next) => {
    let hasAsync = false
    let pending = 0
    let error = null

    flatMapComponents(matched, (def, _, match, key) => {
      if (typeof def === 'function' && def.cid === undefined) {
        hasAsync = true
        pending++

        const resolve = once(resolvedDef => {
          if (isESModule(resolvedDef)) {
            resolvedDef = resolvedDef.default
          }
          // save resolved on async factory in case it's used elsewhere
          def.resolved = typeof resolvedDef === 'function'
            ? resolvedDef
            : _Vue.extend(resolvedDef)
          match.components[key] = resolvedDef
          pending--
          if (pending <= 0) {
            next()
          }
        })

        const reject = once(reason => {
          const msg = `Failed to resolve async component ${key}: ${reason}`
          process.env.NODE_ENV !== 'production' && warn(false, msg)
          if (!error) {
            error = isError(reason)
              ? reason
              : new Error(msg)
            next(error)
          }
        })

        let res
        try {
          res = def(resolve, reject)
        } catch (e) {
          reject(e)
        }
        if (res) {
          if (typeof res.then === 'function') {
            res.then(resolve, reject)
          } else {
            // new syntax in Vue 2.3
            const comp = res.component
            if (comp && typeof comp.then === 'function') {
              comp.then(resolve, reject)
            }
          }
        }
      }
    })

    if (!hasAsync) next()
  }
}
```
会看到 resolveAsyncComponents 方法会返回一个路由钩子函数（有标准的to，from，next 参数），这个路由钩子函数会在下面的 runQueue 方法中被执行，这里我就先把它的执行说了吧。路由钩子函数内部先是调用 flatMapComponents 方法从传入的 matched 数组中获取到每一个routeRecord 中的组件，然后对组件类型进行判断，如果是异步组件就会执行异步组件解析逻辑，每次解析完成一个后会将解析后的组件存入对应组件中 ` match.components[key] = resolvedDef`，然后 next() 执行下一个。所以当 resolveAsyncComponents 方法返回的路由钩子函数执行完之后，我们就可以拿到所有被激活的组件实例了。

以上5步完成后 queue 这个对列数组就构建完毕了，然后定义了一个迭代器 iterator （用来执行对列）。

```js
<!--src/history/base.js-->

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
            //执行 step(index + 1),让循环继续执行，这就是为啥守卫中一定要写next()才可以继续向下执行下一个守卫的原因
            next(to)
          }
        })
      } catch (e) {
        abort(e)
      }
    }
```

#### runQueue

```js
<!--src/history/base.js-->

   /**
     * 执行对列(就是使用iterator迭代器迭代执行queue队列)
     */
    runQueue(queue, iterator, () => {
      const postEnterCbs = []
      const isValid = () => this.current === route
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
        
        //遍历 postEnterCbs 数组（数组元素就是 在項目中定义的 beforeRouteEnter 守卫里我們给 next //传入的用于在组件实例创建好后调用的那个回调函数）,
        //这里就是执行这个回调的地方，因为此时组件实例已经被创建了
        if (this.router.app) {
          this.router.app.$nextTick(() => {
            postEnterCbs.forEach(cb => {
              cb()
            })
          })
        }
      })
    })
```

```js
<!--src/util/async.js-->

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
```
runQueue 方法接受三次参数 `queue: 对列`，`fn: 迭代器`， `cb: 对列执行完后的回调`，先是定义了 一个 step 递归函数，然后 step(0)开启，index 从 0 开始，因此也就是从 queue 的第一个元素开始调用 fn(迭代器函数)开启对对列迭代。迭代器第二个参数是一个函数，该函数会在迭代器中迭代目标（传入的路由守卫）next() 时候被调用，进而执行 step(index + 1) 推进 runQueue 向前继续执行。这里有一个要被揭晓的谜底，就是文档中说 **要确保路由守卫中调用 next 方法，否则钩子就不会被 resolved**，当然这里不包含 afterEach （afterEach 执行时导航已经被确认，next 参数就没有存在的意义了），原因是对列的执行是靠 step(index + 1) 推进，step(index + 1) 的下次调用是在迭代器中的路由守卫 第三个参数中执行，这第三个参数就是调用守卫函数时传入的 next。

queue 对列被迭代执行完成后，下来会调用 cb（对列执行完成后的回调）。此时，我想了下在继续 cb 之前要复制官方文章一段流程文字进来，相信会很惊喜！

* 导航被触发。
* 在失活的组件里调用离开守卫。
* 调用全局的 beforeEach 守卫。
* 在重用的组件里调用 beforeRouteUpdate 守卫 (2.2+)。
* 在路由配置里调用 beforeEnter。
* 解析异步路由组件。

神不神奇，惊不惊喜，从 transitionTo 方法被触发到此时的对列被迭代执行完成所做的事就总结为上面这6句话，我相信这样一看，思路更加清晰了。

下来我们继续看 cb 的表演，首先是提取调用 extractEnterGuards 方法来提取出 actived 数组中所有将要被激活组件中的 beforeRouteEnter 守卫

```js
<!--src/history/base.js-->

/**
 * 提取actived数组中所有将要激活组件中的 beforeRouteEnter 守卫
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
```
然后将提取的 beforeRouteEnter 数组和注册的全局 beforeResolve 数组（beforeResolve 注册方式跟beforeEach类似，这里就不再赘述）concat 连接合并成一个数组，这是一个子元素为 beforeRouteEnter 和 beforeResolve 路由守卫的数组，下来再次调用 runQueue 使用迭代器对 beforeRouteEnter 和 beforeResolve 进行迭代执行，当这两个路由守卫执行完成后，我要再次从官方文档搬进来两句话进来:

* 在被激活的组件里调用 beforeRouteEnter
* 调用全局的 beforeResolve

>这里需要注意一个小点：使用 extractEnterGuards 提取 beforeRouteEnter 守卫时会用到 bindEnterGuard 方法（上方代码片段中），注意它的第4个参数 cbs，cbs 就是 postEnterCbs 数组，用来存放我们在项目中定义 beforeRouteEnter 守卫时给 next 传入的用于在组件实例创建好后调用的那个回调函数，这里先提出来，然后 postEnterCbs 的执行时机会在后面讲到。

然后是又执行新的 cb 回调函数，cb 中会调用 confirmTransition 的第二个参数 onComplete 回调，onComplete 从名字不难猜出它的作用，就是执行路由切换确认及确认后的事情。

```js
<!--src/history/base.js-->

  transitionTo () {
   ...
    this.confirmTransition(
      route,
      () => { //onComplete： 该回调函数在下方第二个runQueue()中执行
        //更新当前路由 this.current = route, app._route = route
        this.updateRoute(route)
        onComplete && onComplete(route)
        //锁定最新url(将浏览器url地址栏中的路由地址替换成当前最新的)
        this.ensureURL()
      }
    )
  }

```

会看到 onComplete 中首先会调用 updateRoute 方法更新当前路由，然后执行 transitionTo 方法上的 onComplete 回调），下来再调用 ensureURL 将浏览器地址栏的url修改成最新的，这里的替换是由浏览器原生 history 对象中的 pushState 或 replaceState 实现的。

```js
<!--src/history/base.js-->

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
```

updateRoute 做了三件事：
 * 修改 current 值为最新的 route
 * 将 route 作为参数传入 cb 并调用 cb
 * 执行 afterEach 守卫

这里的 cb 可能大家有点忘记了，它就是我们之前在 src->index.js 的 init 方法最后调用 history.listen()传入的那个回调函数，可以返回去瞅瞅。其实就做了一个操作：`app._route = route`。这里的 app 就是当前的 Vue 根实例，`_route` 等同于 `$route` ，因为 `_route` 是响应式的，`<route-view>` 组件的render 函数对 `_route` 又有依赖,因此 `_route` 改变,`render` 函数会重新执行,因此更新视图。

到此又做了了3件大事，再次将官方文档中两句经典的话引入进来：

* 导航被确认
* 调用全局的 afterEach 钩子
* 触发 DOM 更新


就差最后一步了，先贴出代码片段：

```js
  <!--src/history/base.js-->
  
  /**
     * 执行对列(就是使用iterator迭代器迭代执行queue队列)
     */
    runQueue(queue, iterator, () => {
      const postEnterCbs = []
      ...
      runQueue(queue, iterator, () => {
         ...
        //遍历 postEnterCbs 数组（数组元素就是 在項目中定义的 beforeRouteEnter 守卫里我們给 next 传入的用于在组件实例创建好后调用的那个回调函数）,
        //这里就是执行这个回调的地方，因为此时组件实例已经被创建了
        if (this.router.app) {
          this.router.app.$nextTick(() => {
            postEnterCbs.forEach(cb => {
              cb()
            })
          })
        }
      })
    })

```
遍历 postEnterCbs 数组，执行 beforeRouteEnter 守卫中在 next 里面定义的用于在组件实例创建好后执行的回调函数，此时此刻就是执行该回调的时机，如果问 why ？那您细品。

同样将最后一件事从官方文档搬过来。

* 用创建好的实例调用 beforeRouteEnter 守卫中传给 next 的回调函数。


其实路由切换这部分源码（从 transitionTo 开始往后的这部分）本应该放到 push 或 replace 方法执行的时候说，但为了将从插件的安装，然后到初始化再到组件实例被创建这一连串环节 vue-router 所执行的操作连贯的呈现出来，就没有忍心刹车，不过我是觉得这样也不太影响对路由切换这部分源码执行的理解。这样也有个好处，就是对 push 和 replace 的分析就简单多了，因为它们背后的原理，上面基本都讲到了，所以下面我们就快速过一下就好。

### push

```js
<!--src/index.js-->

  /**
   * push 方法
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
```
上面这个 push 方法就是我们在项目中通过 `this.$router.push` 访问的方法，它内部最终会调用 VueRouter 类的构造函数开始初始化的 history 实例上 push 方法。

```js
  /**
   * push方法
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
```

我们这里还依旧使用 history 模式下的 push 方法作分析（hash 模式下的可以看我在源码中的注释，还是比较想起的）。会发现 push 方法中调用了 transitionTo 方法来开启路由过渡，这部分就会重复我们上面讲的逻辑，唯一差别是在路由初始化那会调用的 transitionTo 方法没有传第二个参数（路由确认切换成功后的回调函数），这个回调做的事情也比较简单，请看注释吧，我就叨叨啦。哈哈，push 就完啦，惊不惊喜，意不意外。

### replace 

```js
<!--src/index.js-->

  /**
   * replace方法
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
```
跟 push 类似 这个 replace 方法就是我们在项目中通过 `this.$router.replace` 访问的方法，它内部最终会调用 VueRouter 类的构造函数开始初始化的 history 实例上 replace 方法。

```js
  /**
   * replace方法,跟push执行流程一样,只是调用浏览器原生 history 对象中的 replaceState()方法更新浏览器页面栈
   */
  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(location, route => {
      replaceState(cleanPath(this.base + route.fullPath))
      handleScroll(this.router, route, fromRoute, false)
      onComplete && onComplete(route)
    }, onAbort)
  }
```
也是会调用 transitionTo 方法开启路由切换，逻辑也就不多说了（hash模式请参考源码中的注释）。

聊到这里，本文已接近尾声，但总感觉还差点啥，想起来了，两个全局组件 `<router-view>` 和 `<router-link>`还没有照顾到。

###  RouterView

```js
<!--src/components/view.js-->

//functional: 表示当前组件是一个函数式组件,functional组件渲染依赖render函数
export default {
  name: 'RouterView',
  functional: true,
  props: {
    name: {
      type: String,
      default: 'default'
    }
  },
  //render函数,执行渲染的
  render (_, { props, children, parent, data }) {
    // used by devtools to display a router-view badge
    data.routerView = true

    // directly use parent context's createElement() function
    // so that components rendered by router-view can resolve named slots
    //createElement()函数
    const h = parent.$createElement
    const name = props.name
    const route = parent.$route
    const cache = parent._routerViewCache || (parent._routerViewCache = {})

    // determine current view depth, also check to see if the tree
    // has been toggled inactive but kept-alive.
    let depth = 0
    let inactive = false
    //<router-view> 是支持嵌套的,嵌套关系层级反映到路由配置就是children层级,while循环从调用当前<router-view>组件的父节点(父组件)开始循环,遇到父节点中的<routerView>,
    //就给depth + 1 ,直到vue根节点结束,此时depth表示当前组件嵌套线路中使用<router-view>的数量,也就是层级,这个depth在下面match匹配时会用到
    while (parent && parent._routerRoot !== parent) {
      const vnodeData = parent.$vnode ? parent.$vnode.data : {}                          
      if (vnodeData.routerView) {
        depth++
      }
      if (vnodeData.keepAlive && parent._directInactive && parent._inactive) {
        inactive = true
      }
      parent = parent.$parent
    }
    //将depth 保存给 routerViewDepth
    data.routerViewDepth = depth

    // render previous view if the tree is inactive and kept-alive
    if (inactive) {
      const cachedData = cache[name]
      const cachedComponent = cachedData && cachedData.component
      if (cachedComponent) {
        // #2301
        // pass props
        if (cachedData.configProps) {
          fillPropsinData(cachedComponent, data, cachedData.route, cachedData.configProps)
        }
        return h(cachedComponent, data, children)
      } else {
        // render previous empty view
        return h()
      }
    }
    //这里depth用处的地方,会发现,depth的值会作为matched数组的索引来获取对应的route
    const matched = route.matched[depth]
    const component = matched && matched.components[name]
    // render empty node if no matched route or no config component
    if (!matched || !component) {
      cache[name] = null
      return h()
    }

    // cache component
    cache[name] = { component }

    // attach instance registration hook
    // this will be called in the instance's injected lifecycle hooks
    //注册路由实例,这里的 registerRouteInstance 在 install.js 中 registerInstance 方法中调用
    data.registerRouteInstance = (vm, val) => {
      // val could be undefined for unregistration,如果val未定义就是注销
      const current = matched.instances[name]
      if (
        (val && current !== vm) ||
        (!val && current === vm)
      ) {
        matched.instances[name] = val
      }
    }

    // also register instance in prepatch hook
    // in case the same component instance is reused across different routes
    ;(data.hook || (data.hook = {})).prepatch = (_, vnode) => {
      matched.instances[name] = vnode.componentInstance
    }

    // register instance in init hook
    // in case kept-alive component be actived when routes changed
    data.hook.init = (vnode) => {
      if (vnode.data.keepAlive &&
        vnode.componentInstance &&
        vnode.componentInstance !== matched.instances[name]
      ) {
        matched.instances[name] = vnode.componentInstance
      }
    }

    const configProps = matched.props && matched.props[name]
    // save route and configProps in cachce
    if (configProps) {
      extend(cache[name], {
        route,
        configProps
      })
      fillPropsinData(component, data, route, configProps)
    }

    //调用 createElement函数 根据component 渲染出 当前组件的vonde(真正执行页面的地方)
    return h(component, data, children)
  }
}

function fillPropsinData (component, data, route, configProps) {
  // resolve props
  let propsToPass = data.props = resolveProps(route, configProps)
  if (propsToPass) {
    // clone to prevent mutation
    propsToPass = data.props = extend({}, propsToPass)
    // pass non-declared props as attrs
    const attrs = data.attrs = data.attrs || {}
    for (const key in propsToPass) {
      if (!component.props || !(key in component.props)) {
        attrs[key] = propsToPass[key]
        delete propsToPass[key]
      }
    }
  }
}

function resolveProps (route, config) {
  switch (typeof config) {
    case 'undefined':
      return
    case 'object':
      return config
    case 'function':
      return config(route)
    case 'boolean':
      return config ? route.params : undefined
    default:
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false,
          `props in "${route.path}" is a ${typeof config}, ` +
          `expecting an object, function or boolean.`
        )
      }
  }
}

```

RouterView 是 一个 functional 组件，其作用是将路由匹配到的组件渲染出来，其渲染依赖于 render 函数。render 函数中首先会执行一个 while 循环，该循环会从调用当前 `<router-view>` 组件的父节点开始循环,遇到父节点中的 `<routerView>`,就给 depth +1,直到 vue 根节点结束,此时 depth 表示当前组件嵌套线路中使用 `<router-view>` 的数量,也就是层级,这个 depth 在后面 match 匹配时会用到。

```js
<!--src/components/view.js-->
    render() {
        ...
        let depth = 0
        //<router-view> 是支持嵌套的,嵌套关系层级反映到路由配置就是children层级,while循环从调用当前<router-view>组件的父节点(父组件)开始循环,遇到父节点中的<routerView>,
        //就给depth + 1 ,直到vue根节点结束,此时depth表示当前组件嵌套线路中使用<router-view>的数量,也就是层级,这个depth在下面match匹配时会用到
        while (parent && parent._routerRoot !== parent) {
          const vnodeData = parent.$vnode ? parent.$vnode.data : {}                          
          if (vnodeData.routerView) {
            depth++
          }
          if (vnodeData.keepAlive && parent._directInactive && parent._inactive) {
            inactive = true
          }
          parent = parent.$parent
        }
        ...
    }
```
然后将记录组件嵌套线路中使用 `<router-view>` 数量的 depth 会作为 matched  数组的索引从 matched 中获取数组中下标为 depth 的 `routeRecord` ,然后将路由组件拿出来，后面调用createElement渲染组件

```js
<!--src/components/view.js-->

   render() {
        //这里depth用处的地方,会发现,depth的值会作为matched数组的索引从matched中获取对应的routeRecord
        const matched = route.matched[depth]
        //最终将路由组件拿出来，后面调用createElement渲染
        const component = matched && matched.components[name]
   }
    
```
接下来注册路由实例,这里的 registerRouteInstance 在 install.js 中 registerInstance 方法中调用。

```js
<!--src/components/view.js-->
   
render(){
    ...
     data.registerRouteInstance = (vm, val) => {
      // val could be undefined for unregistration,如果val未定义就是注销
      const current = matched.instances[name]
      if (
        (val && current !== vm) ||
        (!val && current === vm)
      ) {
        matched.instances[name] = val
      }
    }
    ...
}
   
```

最后调用 createElement 函数渲染组件

```js
render(){
...
    //调用 createElement函数 根据component 渲染出当前组件的vnode
    return h(component, data, children)
}
 
```

### RouterLink

```js
 <!--src/components/link.js-->
 
// work around weird flow bug
const toTypes: Array<Function> = [String, Object]
const eventTypes: Array<Function> = [String, Array]

const noop = () => {}

export default {
  name: 'RouterLink',
  //可以在<router-link>标签上出入的props属性,to为必填项,其余为可选
  props: {
    //to
    to: {
      type: toTypes, //类型为对象或者字符串
      required: true
    },

    //tag: 默认为 a 标签
    tag: {
      type: String,
      default: 'a'
    },
    //是否是严格匹配
    exact: Boolean,
    append: Boolean,
    //replace
    replace: Boolean,
    activeClass: String,
    exactActiveClass: String,
    //event 默认是click,类型数组或者字符串
    event: {
      type: eventTypes,
      default: 'click'
    }
  },
  //<router-link>组件渲染也是依赖render函数
  render (h: Function) {
    const router = this.$router //router对象
    const current = this.$route //当前route对象
    //调用resolve先进行路由解析,location: 规范化后的目标location,route:通过match匹配然后调用createRoute生成的 最终目标route
    //href: 通过调用 createHref 计算出来的最终要跳转的href
    const { location, route, href } = router.resolve(
      this.to,
      current,
      this.append
    )

    const classes = {}
    const globalActiveClass = router.options.linkActiveClass
    const globalExactActiveClass = router.options.linkExactActiveClass
    // Support global empty active class
    //这里是对 exactActiveClass  和 activeClass 进行处理
    const activeClassFallback =
      globalActiveClass == null ? 'router-link-active' : globalActiveClass
    const exactActiveClassFallback =
      globalExactActiveClass == null
        ? 'router-link-exact-active'
        : globalExactActiveClass
    const activeClass =
      this.activeClass == null ? activeClassFallback : this.activeClass
    const exactActiveClass =
      this.exactActiveClass == null
        ? exactActiveClassFallback
        : this.exactActiveClass

    const compareTarget = route.redirectedFrom
      ? createRoute(null, normalizeLocation(route.redirectedFrom), null, router)
      : route

    classes[exactActiveClass] = isSameRoute(current, compareTarget)
    //当配置 exact 为 true 的时候，只有当目标路径和当前路径完全匹配的时候，会添加 exactActiveClass；
    //当目标路径包含当前路径的时候，会添加 activeClass。
    classes[activeClass] = this.exact
      ? classes[exactActiveClass]
      : isIncludedRoute(current, compareTarget)

    
    //handler函数 当监听到点击事件或者通过props传入的事件类型发生时就会执行handler函数,最终会调用router.push 或 router.replace执行路由跳转
    //这也就是为啥说<router-link>最终也是通过调用push 或者replace方法进行路由跳转的原因了
    const handler = e => {
      if (guardEvent(e)) {
        if (this.replace) {
          router.replace(location, noop)
        } else {
          router.push(location, noop)
        }
      }
    }

    const on = { click: guardEvent }
    if (Array.isArray(this.event)) {
      this.event.forEach(e => {
        on[e] = handler
      })
    } else {
      on[this.event] = handler
    }

    const data: any = { class: classes }

    const scopedSlot =
      !this.$scopedSlots.$hasNormal &&
      this.$scopedSlots.default &&
      this.$scopedSlots.default({
        href,
        route,
        navigate: handler,
        isActive: classes[activeClass],
        isExactActive: classes[exactActiveClass]
      })

    if (scopedSlot) {
      if (scopedSlot.length === 1) {
        return scopedSlot[0]
      } else if (scopedSlot.length > 1 || !scopedSlot.length) {
        if (process.env.NODE_ENV !== 'production') {
          warn(
            false,
            `RouterLink with to="${
              this.to
            }" is trying to use a scoped slot but it didn't provide exactly one child. Wrapping the content with a span element.`
          )
        }
        return scopedSlot.length === 0 ? h() : h('span', {}, scopedSlot)
      }
    }

    //判断props 属性 tag 是否是a标签(<router-link> 默认会渲染成 <a> 标签),如果是则将事件直接绑定以及将跳转路径href直接赋给attrs属性,
    //如果不是则尝试递归去寻找其子元素中的a标签如果找到则将事件绑定到a标签上并添加href属性,否则(没有找到)则将事件直接绑定到当前tag元素本身
    if (this.tag === 'a') {
      data.on = on
      data.attrs = { href }
    } else {
      // find the first <a> child and apply listener and href
      const a = findAnchor(this.$slots.default)
      if (a) {
        // in case the <a> is a static node
        a.isStatic = false
        const aData = (a.data = extend({}, a.data))
        aData.on = aData.on || {}
        // transform existing events in both objects into arrays so we can push later
        for (const event in aData.on) {
          const handler = aData.on[event]
          if (event in on) {
            aData.on[event] = Array.isArray(handler) ? handler : [handler]
          }
        }
        // append new listeners for router-link
        for (const event in on) {
          if (event in aData.on) {
            // on[event] is always a function
            aData.on[event].push(on[event])
          } else {
            aData.on[event] = handler
          }
        }

        const aAttrs = (a.data.attrs = extend({}, a.data.attrs))
        aAttrs.href = href
      } else {
        // doesn't have <a> child, apply listener to self
        data.on = on
      }
    }

    return h(this.tag, data, this.$slots.default)
  }
}

//守卫函数: 会守卫点击事件，让浏览器不再重新加载页面
function guardEvent (e) {
  // don't redirect with control keys
  if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return
  // don't redirect when preventDefault called
  if (e.defaultPrevented) return
  // don't redirect on right click
  if (e.button !== undefined && e.button !== 0) return
  // don't redirect if `target="_blank"`
  if (e.currentTarget && e.currentTarget.getAttribute) {
    const target = e.currentTarget.getAttribute('target')
    if (/\b_blank\b/i.test(target)) return
  }
  // this may be a Weex event which doesn't have this method
  if (e.preventDefault) {
    e.preventDefault()
  }
  return true
}

//当我们传入的props tag 不是 a标签的时候则会递归的方式尝试寻找其子元素的 a标签如果找到则返回tag为 a 的子元素
function findAnchor (children) {
  if (children) {
    let child
    for (let i = 0; i < children.length; i++) {
      child = children[i]
      if (child.tag === 'a') {
        return child
      }
      if (child.children && (child = findAnchor(child.children))) {
        return child
      }
    }
  }
}

```

RouteLink 组件首先是可以接收多个 props 选项，其中 to 是必传选型，其余都是可选，默认 tag 标签为 a ，默认触发跳转的事件为 click。该组件渲染也依赖于 render 函数，render 函数中首先拿到 router （`$router`）实例 和 当前激活态 route 对象（`$route`）,然后调用 `router.resolve()` 进行路由解析后取出 location、route、href。（location 表示规范化后的目标 location, route表示通过 match 匹配然后调用 createRoute 生成的最终目标 route，href 表示通过调用 createHref 计算出来的最终要跳转的 href ）

```js
 <!--src/components/link.js-->
 
   render (h: Function) {
        const router = this.$router //router对象
        const current = this.$route //当前route对象
        //调用resolve先进行路由解析,location: 规范化后的目标location,route:通过match匹配然后调用createRoute生成的 最终目标route
        //href: 通过调用 createHref 计算出来的最终要跳转的href
        const { location, route, href } = router.resolve(
          this.to,
          current,
          this.append
        )
        ...
   }
 
```

下来是对  exactActiveClass  和 activeClass 进行处理，当配置 exact 为 true 的时候，只有当目标路径和当前路径完全匹配的时候，会给链接元素（默认 a 标签）自动设置一个表示激活的 CSS 类名 exactActiveClass；否则当目标路径包含当前路径的时候，会添加 activeClass。

```js
<!--src/components/link.js-->
...
    const classes = {}
    const globalActiveClass = router.options.linkActiveClass
    const globalExactActiveClass = router.options.linkExactActiveClass
    // Support global empty active class
    //这里是对 exactActiveClass  和 activeClass 进行处理
    const activeClassFallback =
      globalActiveClass == null ? 'router-link-active' : globalActiveClass
    const exactActiveClassFallback =
      globalExactActiveClass == null
        ? 'router-link-exact-active'
        : globalExactActiveClass
    const activeClass =
      this.activeClass == null ? activeClassFallback : this.activeClass
    const exactActiveClass =
      this.exactActiveClass == null
        ? exactActiveClassFallback
        : this.exactActiveClass

    const compareTarget = route.redirectedFrom
      ? createRoute(null, normalizeLocation(route.redirectedFrom), null, router)
      : route

    classes[exactActiveClass] = isSameRoute(current, compareTarget)
    //当配置 exact 为 true 的时候，只有当目标路径和当前路径完全匹配的时候，会添加 exactActiveClass；
    //当目标路径包含当前路径的时候，会添加 activeClass。
    classes[activeClass] = this.exact
      ? classes[exactActiveClass]
      : isIncludedRoute(current, compareTarget)
```

接下里定义了一个 handler 函数，当监听到点击事件或者通过 props 传入的事件类型发生时就会执行 handler 函数，handler 中先调用守卫点击事件 的 guardEvent 守卫函数，guardEvent 返回 true 时表示当前事件有效，然后通过对 props 属性 replace 判断（true/false）调用router.push 或 router.replace 执行路由跳转，这里也就是为啥说 `<router-link>` 最终也是通过调用 push 或者 replace 方法进行路由跳转的原因了
    
```js
<!--src/components/link.js-->

//handler函数 当监听到点击事件或者通过props传入的事件类型发生时就会执行handler函数,最终会调用router.push 或 router.replace执行路由跳转。
const handler = e => {
  if (guardEvent(e)) {
    if (this.replace) {
      router.replace(location, noop)
    } else {
      router.push(location, noop)
    }
  }
}
    
    
//守卫函数: 会守卫点击事件，让浏览器不再重新加载页面
function guardEvent (e) {
  // don't redirect with control keys
  if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return
  // don't redirect when preventDefault called
  if (e.defaultPrevented) return
  // don't redirect on right click
  if (e.button !== undefined && e.button !== 0) return
  // don't redirect if `target="_blank"`
  if (e.currentTarget && e.currentTarget.getAttribute) {
    const target = e.currentTarget.getAttribute('target')
    if (/\b_blank\b/i.test(target)) return
  }
  // this may be a Weex event which doesn't have this method
  if (e.preventDefault) {
    e.preventDefault()
  }
  return true
}

```

最后判断 props 属性 tag 是否是 a 标签（ `<router-link>` 默认会渲染成 `<a>` 标签）,如果是则将事件直接绑定以及将跳转路径href直接赋给 attrs 属性,如果不是则尝试递归去寻找其子元素中的 a 标签如果找到则将事件绑定到 a 标签上并添加 href 属性,否则(没有找到)则将事件直接绑定到当前 tag 元素本身。

```js
<!--src/components/link.js-->

...
//判断props 属性 tag 是否是a标签(<router-link> 默认会渲染成 <a>标签),如果是则将事件直接绑定以及将跳转路径href直接赋给attrs属性,
//如果不是则尝试递归去寻找其子元素中的a标签如果找到则将事件绑定到a标签上并添加href属性,否则(没有找到)则将事件直接绑定到当前tag元素本身
if (this.tag === 'a') {
  data.on = on
  data.attrs = { href }
} else {
  // find the first <a> child and apply listener and href
  const a = findAnchor(this.$slots.default)
  if (a) {
    // in case the <a> is a static node
    a.isStatic = false
    const aData = (a.data = extend({}, a.data))
    aData.on = aData.on || {}
    // transform existing events in both objects into arrays so we can push later
    for (const event in aData.on) {
      const handler = aData.on[event]
      if (event in on) {
        aData.on[event] = Array.isArray(handler) ? handler : [handler]
      }
    }
    // append new listeners for router-link
    for (const event in on) {
      if (event in aData.on) {
        // on[event] is always a function
        aData.on[event].push(on[event])
      } else {
        aData.on[event] = handler
      }
    }

    const aAttrs = (a.data.attrs = extend({}, a.data.attrs))
    aAttrs.href = href
  } else {
    // doesn't have <a> child, apply listener to self
    data.on = on
  }
}
    
    
//当我们传入的props tag 不是 a标签的时候则会递归的方式尝试寻找其子元素的 a标签如果找到则返回tag为 a 的子元素
function findAnchor (children) {
  if (children) {
    let child
    for (let i = 0; i < children.length; i++) {
      child = children[i]
      if (child.tag === 'a') {
        return child
      }
      if (child.children && (child = findAnchor(child.children))) {
        return child
      }
    }
  }
}

```

### 结语
到此，本文对 vue-router 源码的解析就全部结束了，初衷是结合自己在过程中的分析方法和思路，然后通过写这篇文章形成一条逻辑主线分享给大家，因此在叙述的过程中没有特别详细和具体的表述。细节的话，建议大家去看我源代码中的注释，个人认为还是比较详细的，都是我在分析过程中留下的分析笔记。同时由于本文篇幅较长，因此可能会存在许多表达上的不通顺或者不准确地方，还望路过的各位小伙伴及时指正，蟹蟹啦！

