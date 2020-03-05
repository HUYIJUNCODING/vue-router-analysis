/* @flow */

import type VueRouter from '../index'
import { parsePath, resolvePath } from './path'
import { resolveQuery } from './query'
import { fillParams } from './params'
import { warn } from './warn'
import { extend } from './misc'

export function normalizeLocation (
  raw: RawLocation,
  current: ?Route,
  append: ?boolean,
  router: ?VueRouter
): Location {
  //判断传入的目标路由格式(字符串/对象),这里的raw就是push或者replace方法的第一个参数,
  //这个就是path也只能是path.当字符串的形式时候不能是name,name必须使用对象属性声明使用(要去哪)
  let next: Location = typeof raw === 'string' ? { path: raw } : raw 
  // named target
  if (next._normalized) { //Todo
    return next
  } else if (next.name) {
    next = extend({}, raw) //将raw对象属性复制进一个新对象(raw 对象副本)
    const params = next.params 
    if (params && typeof params === 'object') {
      next.params = extend({}, params) //params 对象副本
    }
    return next
  }

  // relative params
  if (!next.path && next.params && current) {
    next = extend({}, next)
    next._normalized = true
    const params: any = extend(extend({}, current.params), next.params)
    if (current.name) {
      next.name = current.name
      next.params = params
    } else if (current.matched.length) {
      const rawPath = current.matched[current.matched.length - 1].path
      next.path = fillParams(rawPath, params, `path ${current.path}`)
    } else if (process.env.NODE_ENV !== 'production') {
      warn(false, `relative params navigation requires a current route.`)
    }
    return next
  }

  const parsedPath = parsePath(next.path || '')
  const basePath = (current && current.path) || '/'
  const path = parsedPath.path
    ? resolvePath(parsedPath.path, basePath, append || next.append)
    : basePath

  const query = resolveQuery(
    parsedPath.query,
    next.query,
    router && router.options.parseQuery
  )

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
