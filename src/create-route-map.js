/* @flow */

import Regexp from 'path-to-regexp'
import { cleanPath } from './util/path'
import { assert, warn } from './util/warn'

/**
 * 创建路由映射表(用户路由配置->路由映射表)
 * @param {*} routes 
 * @param {*} oldPathList
 * @param {*} oldPathMap 
 * @param {*} oldNameMap 
 */
export function createRouteMap (
  routes: Array<RouteConfig>, //new VueRoute()时传入的路由配置中的routes
  oldPathList?: Array<string>,
  oldPathMap?: Dictionary<RouteRecord>,
  oldNameMap?: Dictionary<RouteRecord>
): {
  pathList: Array<string>,
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>
} {
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

/**
 * 添加路由记录,这个方法就是把用户路由配置转换成路由映射表的执行者
 * @param {*} pathList 
 * @param {*} pathMap 
 * @param {*} nameMap 
 * @param {*} route 
 * @param {*} parent 
 * @param {*} matchAs 
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

/**
 * 编译路径正则表达式(实际上是通过 path-to-regexp 工具库,把 path 解析成一个正则表达式的扩展,生成的路径regex很重要,
 * 路由匹配就是通过它来完成的)
 * @param {*} path 
 * @param {*} pathToRegexpOptions 
 */
function compileRouteRegex (
  path: string, //''
  pathToRegexpOptions: PathToRegexpOptions // {}
): RouteRegExp {
  //通过 利用path-to-regexp 工具库把path解析成一个正则表达式扩展
  const regex = Regexp(path, [], pathToRegexpOptions)
  if (process.env.NODE_ENV !== 'production') {
    const keys: any = Object.create(null)
    regex.keys.forEach(key => {
      warn(
        !keys[key.name],
        `Duplicate param keys in route with path: "${path}"`
      )
      keys[key.name] = true
    })
  }
  return regex
}

/**
 * 规范化路径
 * @param {*} path 
 * @param {*} parent 
 * @param {*} strict 
 */
function normalizePath (
  path: string,
  parent?: RouteRecord,
  strict?: boolean
): string {
  if (!strict) path = path.replace(/\/$/, '')
  if (path[0] === '/') return path
  if (parent == null) return path
  return cleanPath(`${parent.path}/${path}`)
}
