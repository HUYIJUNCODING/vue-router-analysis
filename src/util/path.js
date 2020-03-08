/* @flow */

/**
 * 解析路径,根据当前path和next path计算的出一个新的path(三种情况分:next path 为 绝对路径,是参数路径,相对路径),
 * 绝对路径直接返回,参数路径则直接拼接到current path上返回,相对路径先计算relative相对base的位置然后base+relative返回计算后的绝对路径
 * @param {*} relative 
 * @param {*} base 
 * @param {*} append 
 */
export function resolvePath (
  relative: string,
  base: string,
  append?: boolean
): string {
  const firstChar = relative.charAt(0)
  if (firstChar === '/') {
    return relative
  }

  if (firstChar === '?' || firstChar === '#') {
    return base + relative
  }

  const stack = base.split('/')

  // remove trailing segment if:
  // - not appending
  // - appending to trailing slash (last segment is empty)
  if (!append || !stack[stack.length - 1]) {
    stack.pop()
  }

  // resolve relative path
  const segments = relative.replace(/^\//, '').split('/')
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (segment === '..') {
      stack.pop()
    } else if (segment !== '.') {
      stack.push(segment)
    }
  }

  // ensure leading slash
  if (stack[0] !== '') {
    stack.unshift('')
  }

  return stack.join('/')
}

/**
 * 解析路径,会根据路径中有#和?的情况将对path解析,分离出path,hash,query返回(功能为分离参数的路径解析方法)
 * @param {*} path 
 */
export function parsePath (path: string): {
  path: string;
  query: string;
  hash: string;
} {
  let hash = ''
  let query = ''
//路径中有#号的情况下,分离出hash 和path
  const hashIndex = path.indexOf('#')
  if (hashIndex >= 0) {
    hash = path.slice(hashIndex)
    path = path.slice(0, hashIndex)
  }

  //路径中有?号的情况下,分离query和path
  const queryIndex = path.indexOf('?')
  if (queryIndex >= 0) {
    query = path.slice(queryIndex + 1)
    path = path.slice(0, queryIndex)
  }
  //将解析结果返回
  return {
    path,
    query,
    hash
  }
}

export function cleanPath (path: string): string {
  return path.replace(/\/\//g, '/')
}
