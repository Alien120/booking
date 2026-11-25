/* 管理端主框架：布局 + hash 路由 */
(function () {
  const api = window.AdminAPI;
  const state = window.AdminState;
  const util = window.AdminUtil;
  const setAuth = window.AdminSetAuth;

  const NAV = [
    {
      group: '概览',
      items: [
        { key: 'dashboard', label: '预约看板' },
        { key: 'appointments', label: '预约列表' },
        { key: 'calendar', label: '预约日历' }
      ]
    },
    { group: '客户', items: [{ key: 'customers', label: '客户管理' }] },
    {
      group: '门店设置',
      items: [
        { key: 'services', label: '服务项目', role: 2 },
        { key: 'hours', label: '营业时间', role: 2 },
        { key: 'qrcode', label: '预约二维码', role: 2 },
        { key: 'reminder', label: '提醒设置', role: 2 }
      ]
    },
    {
      group: '数据与权限',
      items: [
        { key: 'stats', label: '数据统计', role: 2 },
        { key: 'users', label: '账号与审计', role: 1 }
      ]
    }
  ];

  const App = {
    data() {
      return {
        state: state,
        route: 'dashboard',
        nav: NAV,
        refreshKey: 0,
        menuOpen: false
      };
    },
    computed: {
      currentTitle() {
        for (const g of NAV) {
          const hit = g.items.find((i) => i.key === this.route);
          if (hit) return hit.label;
        }
        return '预约看板';
      },
      visibleNav() {
        const role = (state.user && state.user.role) || 3;
        return NAV.map((g) => ({
          group: g.group,
          items: g.items.filter((i) => !i.role || role <= i.role)
        })).filter((g) => g.items.length);
      },
      userInitial() {
        const n = (state.user && state.user.name) || 'U';
        return n.slice(0, 1);
      }
    },
    methods: {
      go(key) {
        if (this.route === key) {
          this.refreshKey++;
          return;
        }
        location.hash = '#/' + key;
      },
      syncRoute() {
        const h = location.hash.replace(/^#\/?/, '');
        const key = h.split('?')[0] || 'dashboard';
        const exists = NAV.some((g) => g.items.some((i) => i.key === key));
        this.route = exists ? key : 'dashboard';
      },
      logout() {
        if (!confirm('确认退出登录？')) return;
        setAuth('', null, null);
        location.hash = '';
      },
      onLoginSuccess() {
        this.syncRoute();
      }
    },
    mounted() {
      this.syncRoute();
      window.addEventListener('hashchange', () => {
        this.syncRoute();
        this.refreshKey++; // hash 带参数（如 ?date=）时强制重建页面组件
      });

      // 兼容旧缓存：有登录态但没存门店信息时，补拉一次，避免侧栏显示"门店管理"
      if (state.token && !state.store) {
        window.AdminAPI.businessHours()
          .then((res) => window.AdminUpdateStore({ name: res.store.name }))
          .catch(() => {});
      }
    },
    template: `
<div>
  <view-login v-if="!state.token" @success="onLoginSuccess"></view-login>

  <div v-else class="layout">
    <aside class="sidebar">
      <div class="brand" :data-initial="state.store && state.store.name ? state.store.name.slice(0, 1) : 'S'">
        <div class="brand-name">{{ state.store ? state.store.name : '门店管理' }}</div>
        <div class="brand-sub">SALON ADMIN</div>
      </div>
      <nav class="nav">
        <template v-for="g in visibleNav" :key="g.group">
          <div class="nav-group">{{ g.group }}</div>
          <div v-for="i in g.items" :key="i.key"
               class="nav-item" :class="{ on: route === i.key }" @click="go(i.key)">
            <i class="nav-dot"></i><span>{{ i.label }}</span>
          </div>
        </template>
      </nav>
      <div class="sidebar-foot">v1.0 · 单店版</div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="topbar-title">{{ currentTitle }}</div>
        <div class="topbar-right">
          <span v-if="state.loading > 0" class="small muted"><i class="spinner"></i>加载中</span>
          <div class="avatar" :title="state.user ? state.user.roleText : ''">{{ userInitial }}</div>
          <span class="small">{{ state.user ? state.user.name : '' }}</span>
          <button class="btn btn-ghost btn-sm" @click="logout">退出</button>
        </div>
      </header>

      <div class="content">
        <component :is="'view-' + route" :key="route + '-' + refreshKey"></component>
      </div>
    </div>
  </div>

  <div class="toast-wrap">
    <div v-for="t in state.toasts" :key="t.id" class="toast" :class="{ err: t.type === 'err' }">{{ t.message }}</div>
  </div>
</div>
`
  };

  const app = Vue.createApp(App);

  // 注册页面组件
  const views = window.Views || {};
  Object.keys(views).forEach((name) => {
    app.component('view-' + name, views[name]);
  });

  app.mount('#app');
})();
