/* @flow */

import { createRoute, isSameRoute, isIncludedRoute } from '../util/route'
import { extend } from '../util/misc'
import { normalizeLocation } from '../util/location'
import { warn } from '../util/warn'

// work around weird flow bug
const toTypes: Array<Function> = [String, Object]
const eventTypes: Array<Function> = [String, Array]

const noop = () => {}

export default {
  name: 'RouterLink',
  //props属性,to为必填项,其余为可选
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
