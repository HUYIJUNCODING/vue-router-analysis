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
