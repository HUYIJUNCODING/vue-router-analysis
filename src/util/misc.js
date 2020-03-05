/**
 * 复制目标对象属性,到一个新对象中,返回这个新对象
 * @param {*新副本对象} a 
 * @param {*目标对象} b 
 */
                     //{}  {name: 'xx'}
export function extend (a, b) {
  for (const key in b) {
    a[key] = b[key]
  }
  return a
}
