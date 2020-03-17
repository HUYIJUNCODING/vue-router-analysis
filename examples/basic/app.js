import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

// 1. Use plugin.
// This installs <router-view> and <router-link>,
// and injects $router and $route to all router-enabled child components


// 2. Define route componentsVue.use(VueRouter)
const Home = { template: '<div>home</div>' }
const Foo = { template: '<div>foo</div>' }
const Bar = { template: '<div>bar</div>' }
const Unicode = { template: '<div>unicode</div>' }

// 3. Create the router
const router = new VueRouter({
  mode: 'hash',
  base: __dirname,
  routes: [
    { path: '/', component: Home },
    { path: '/foo', name: 'foo1', },
    { path: '/foo/bar', component: Bar },
    { path: '/é', component: Unicode }
  ]
})

// 4. Create and mount root instance.
// Make sure to inject the router.
// Route components will be rendered inside <router-view>.
new Vue({
  router,
  data: () => ({ n: 0 }),
  template: `
    <div id="app">
      <h1>Basic</h1>
      <ul>
        <li><router-link to="/">/</router-link></li>
        <li><router-link to="/foo/bar">/foo/bar</router-link></li>
        <li><router-link :to='{params: {a:11}}'>/bar</router-link></li>
        <router-link tag="li" to="/bar" :event="['mousedown', 'touchstart']">
          <a>/bar</a>
        </router-link>
        <li><router-link to="/é">/é</router-link></li>
        <li><router-link to="/é?t=%25ñ">/é?t=%ñ</router-link></li>
        <li><router-link to="/é#%25ñ">/é#%25ñ</router-link></li>
        <router-link to="/foo" v-slot="props">
          <li :class="[props.isActive && 'active', props.isExactActive && 'exact-active']">
            <a :href="props.href" @click="props.navigate">{{ props.route.path }} (with v-slot).</a>
          </li>
        </router-link>
        <li><router-link to="/foo" replace>/foo (replace)</router-link></li>
      </ul>
      <button id="navigate-btn" @click="navigateAndIncrement">On Success</button>
      <pre id="counter">{{ n }}</pre>
      <pre id="query-t">{{ $route.query.t }}</pre>
      <pre id="hash">{{ $route.hash }}</pre>
      <router-view class="view"></router-view>
    </div>
  `,

  methods: {
    navigateAndIncrement () {
      const increment = () => this.n++
      if (this.$route.path === '/') {
        this.$router.push({name: 'foo1'}, increment)
      } else {
        this.$router.push('/', increment)
      }
    }
  }
}).$mount('#app')
