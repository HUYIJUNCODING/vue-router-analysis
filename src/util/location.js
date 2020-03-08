/* @flow */

import type VueRouter from '../index'
import { parsePath, resolvePath } from './path'
import { resolveQuery } from './query'
import { fillParams } from './params'
import { warn } from './warn'
import { extend } from './misc'

/**
 * 规范化location,根据raw(this.$router.push/replace的第一个参数)和当前route计算出一个新的location,
 * 返回一个对象 {  _normalized: true,path,query,hash}
 * @param {*} raw 
 * @param {*} current 
 * @param {*} append 
 * @param {*} router 
 */
export function normalizeLocation (
  raw: RawLocation, //目的location,就是this.$router.push/replace时传入的目的路由信息
  current: ?Route,//当前激活态的route(this.$route)
  append: ?boolean,
  router: ?VueRouter //路由对象($router)
): Location {
  //判断传入的raw参数的格式(字符串/对象)
  let next: Location = typeof raw === 'string' ? { path: raw } : raw 
  // named target
  //如果_normalized 属性存在并且为true,则直接返回next
  if (next._normalized) {
    return next
    //如果name存在,则对raw进行拷贝后返回
  } else if (next.name) {
    next = extend({}, raw)
    const params = next.params 
    if (params && typeof params === 'object') {
      next.params = extend({}, params) 
    }
    return next
  }

  // 如果name不存在,path也不存在,params存在那就使用当前路由信息计算出一个新的location
  //(这个新的location是当前路由信息结合目标路由params计算出来的,因此这种情况新的location还是current的,现象就是浏览器url参数变了,但是
  //导航仍然停留在当前页面)
  if (!next.path && next.params && current) {
    next = extend({}, next)
    next._normalized = true
    //合并params
    const params: any = extend(extend({}, current.params), next.params)
    //如果name存在则用name
    if (current.name) {
      next.name = current.name
      next.params = params
      //否则用path
    } else if (current.matched.length) {
      const rawPath = current.matched[current.matched.length - 1].path
      //将params填充进rawPath,生成一个包含param的新path
      next.path = fillParams(rawPath, params, `path ${current.path}`)
    } else if (process.env.NODE_ENV !== 'production') {
      warn(false, `relative params navigation requires a current route.`)
    }
    return next
  }

  //下面是next 的path存在情况,计算出的新的location

  //解析path,返回一个path解析的新对象,{path,query,hash}
  const parsedPath = parsePath(next.path || '')
  //基础路径
  const basePath = (current && current.path) || '/'
  //计算path(绝对路径)
  const path = parsedPath.path
    ? resolvePath(parsedPath.path, basePath, append || next.append)
    : basePath
 
    //解析query参数
  const query = resolveQuery(
    parsedPath.query,
    next.query,
    router && router.options.parseQuery
  )

  //如果hash值不是以#开头则给开头添加#
  let hash = next.hash || parsedPath.hash
  if (hash && hash.charAt(0) !== '#') {
    hash = `#${hash}`
  }

  return {
    _normalized: true,
    path,
    query,
    hash
  }
}
