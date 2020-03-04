import View from './components/view'
import Link from './components/link'

//_Vue 保存的是 install 方法传进来的Vue,导出的目是别的地方也可以使用，这样可以避免将 Vue 打包进代码包里面（不用 import），
//同时还可以使用Vue。
export let _Vue

export function install (Vue) {
  //判断插件是否安装过，如果已经安装过就不能再安装了（只能安装一次）
  if (install.installed && _Vue === Vue) return
  install.installed = true

  //将 Vue保存起来
  _Vue = Vue

 //功能函数：判断 v 是否被定义过
  const isDef = v => v !== undefined

// todo
  const registerInstance = (vm, callVal) => {
    let i = vm.$options._parentVnode
    if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
      i(vm, callVal)
    }
  }

  //vue 全局混入 beforeCreate,destroyed 钩子函数，每一个组件初始化时候都会执行，并且执行顺序在组件内部同名钩子函数之前
  Vue.mixin({
    beforeCreate () {
      //如果是vue根节点（通过判断$options.router是否存在，因为只有根节点的options上挂载了router）
      if (isDef(this.$options.router)) {
        //初始化内置属性_routerRoot 指向自己（vue根节点）
        this._routerRoot = this 
        //初始化内置属性 _router 保存 router(new VueRouter)实例
        this._router = this.$options.router
        //调用 router 实例的init方法，对 router对象进项初始化
        this._router.init(this)
       //初始化内置属性 _route（保存当前被激活的路由信息） 并调用 Vue.util 中的 defineReactive 工具方法将其处理成响应式（处理成响应式的目的是当当前route变更时可以更新视图）
        Vue.util.defineReactive(this, '_route', this._router.history.current)
      } else {
        //否则不是vue根节点，也初始化一个_routerRoot内置属性，然后找到其父节点，将其父节点上的_routerRoot引用给当前
        //组件的_routerRoot属性，这样所有的组件_routerRoot属性都指向vue根节点
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
      }
      registerInstance(this, this)
    },
    destroyed () {
      registerInstance(this)
    }
  })

  Object.defineProperty(Vue.prototype, '$router', {
    get () { return this._routerRoot._router }
  })

  Object.defineProperty(Vue.prototype, '$route', {
    get () { return this._routerRoot._route }
  })

  Vue.component('RouterView', View)
  Vue.component('RouterLink', Link)

  const strats = Vue.config.optionMergeStrategies
  // use the same hook merging strategy for route hooks
  strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created
}
