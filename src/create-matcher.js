/* @flow */

import type VueRouter from './index'
import { resolvePath } from './util/path'
import { assert, warn } from './util/warn'
import { createRoute } from './util/route'
import { fillParams } from './util/params'
import { createRouteMap } from './create-route-map'
import { normalizeLocation } from './util/location'

export type Matcher = {
  match: (raw: RawLocation, current?: Route, redirectedFrom?: Location) => Route;
  addRoutes: (routes: Array<RouteConfig>) => void;
};

/**
 * 路由匹配器函数
 * @param {*} routes 
 * @param {*} router 
 */
export function createMatcher (
  routes: Array<RouteConfig>, //new VueRoute()时传入的路由配置中的routes
  router: VueRouter //router实例对象
): Matcher {
  //创建路由映射表,这张表是一个对象,内部包含 pathList:保存所有路径,pathMap:保存路径到 RouteRecord 的映射关系
  //nameMap: 保存 name到RouteRecord的映射关系
  const { pathList, pathMap, nameMap } = createRouteMap(routes)
  
  /**
   * 动态添加路由,所以我们可以在外部通过该方法动态添加路由配置,然后会调用createRouteMap方法往路由映射表里添加传入的routes对应的 RouteRecord并将
   * 对应关系记录进pathList,pathMap,nameMap中
   * @param {*} routes 
   */
  function addRoutes (routes) {
    createRouteMap(routes, pathList, pathMap, nameMap)
  }

  /**
   * 执行路由匹配,会根据 raw:导航去哪的路由信息(就是我们使用push/replace方法的第一个参数) 和currentRoute:当前路由信息,计算匹配出一个新的路径
   * @param {*} raw 
   * @param {*} currentRoute 
   * @param {*} redirectedFrom 
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

  function redirect (
    record: RouteRecord,
    location: Location
  ): Route {
    const originalRedirect = record.redirect
    let redirect = typeof originalRedirect === 'function'
      ? originalRedirect(createRoute(record, location, null, router))
      : originalRedirect

    if (typeof redirect === 'string') {
      redirect = { path: redirect }
    }

    if (!redirect || typeof redirect !== 'object') {
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false, `invalid redirect option: ${JSON.stringify(redirect)}`
        )
      }
      return _createRoute(null, location)
    }

    const re: Object = redirect
    const { name, path } = re
    let { query, hash, params } = location
    query = re.hasOwnProperty('query') ? re.query : query
    hash = re.hasOwnProperty('hash') ? re.hash : hash
    params = re.hasOwnProperty('params') ? re.params : params

    if (name) {
      // resolved named direct
      const targetRecord = nameMap[name]
      if (process.env.NODE_ENV !== 'production') {
        assert(targetRecord, `redirect failed: named route "${name}" not found.`)
      }
      return match({
        _normalized: true,
        name,
        query,
        hash,
        params
      }, undefined, location)
    } else if (path) {
      // 1. resolve relative redirect
      const rawPath = resolveRecordPath(path, record)
      // 2. resolve params
      const resolvedPath = fillParams(rawPath, params, `redirect route with path "${rawPath}"`)
      // 3. rematch with existing query and hash
      return match({
        _normalized: true,
        path: resolvedPath,
        query,
        hash
      }, undefined, location)
    } else {
      if (process.env.NODE_ENV !== 'production') {
        warn(false, `invalid redirect option: ${JSON.stringify(redirect)}`)
      }
      return _createRoute(null, location)
    }
  }

  function alias (
    record: RouteRecord,
    location: Location,
    matchAs: string
  ): Route {
    const aliasedPath = fillParams(matchAs, location.params, `aliased route with path "${matchAs}"`)
    const aliasedMatch = match({
      _normalized: true,
      path: aliasedPath
    })
    if (aliasedMatch) {
      const matched = aliasedMatch.matched
      const aliasedRecord = matched[matched.length - 1]
      location.params = aliasedMatch.params
      return _createRoute(aliasedRecord, location)
    }
    return _createRoute(null, location)
  }

  /**
   * 创建最终态route
   * @param {*} record 
   * @param {*} location 
   * @param {*} redirectedFrom 
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

  return {
    match,
    addRoutes
  }
}

/**
 * 根据 record.regex,location.path,location.params匹配routeRecord
 * @param {*} regex 
 * @param {*} path 
 * @param {*} params 
 */
function matchRoute (
  regex: RouteRegExp,
  path: string,
  params: Object
): boolean {
  const m = path.match(regex)
 
  //如果匹配到返回true,没有返回false
  if (!m) {
    return false
  } else if (!params) {
    return true
  }
  
  //将record中的params参数收集进location params中
  for (let i = 1, len = m.length; i < len; ++i) {
    const key = regex.keys[i - 1]
    const val = typeof m[i] === 'string' ? decodeURIComponent(m[i]) : m[i]
    if (key) {
      // Fix #1994: using * with props: true generates a param named 0
      params[key.name || 'pathMatch'] = val
    }
  }

  return true
}

function resolveRecordPath (path: string, record: RouteRecord): string {
  return resolvePath(path, record.parent ? record.parent.path : '/', true)
}
