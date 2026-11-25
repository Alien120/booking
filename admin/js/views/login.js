/* 登录页 */
window.Views = Object.assign(window.Views || {}, {
  login: {
    emits: ['success'],
    data() {
      return {
        username: localStorage.getItem('salon_last_user') || '',
        password: '',
        loading: false,
        err: ''
      };
    },
    methods: {
      async submit() {
        if (this.loading) return;
        if (!this.username.trim() || !this.password) {
          this.err = '请输入账号和密码';
          return;
        }
        this.loading = true;
        this.err = '';
        try {
          const res = await window.AdminAPI.login(this.username.trim(), this.password);
          localStorage.setItem('salon_last_user', this.username.trim());
          window.AdminSetAuth(res.token, res.user, res.store);
          window.AdminToast('欢迎回来，' + res.user.name);
          this.$emit('success');
        } catch (e) {
          this.err = e.message || '登录失败';
        } finally {
          this.loading = false;
        }
      }
    },
    template: `
<div class="login-page">
  <div class="login-card">
    <div class="login-brand">SALON ADMIN</div>
    <div class="login-title">门店管理后台</div>
    <div class="login-sub">预约 · 客户 · 核销 · 统计</div>

    <div class="col" style="gap:14px">
      <div class="field">
        <label class="field-label">账号</label>
        <input class="input" v-model="username" placeholder="请输入账号" @keyup.enter="submit" autocomplete="username" />
      </div>
      <div class="field">
        <label class="field-label">密码</label>
        <input class="input" type="password" v-model="password" placeholder="请输入密码"
               @keyup.enter="submit" autocomplete="current-password" />
      </div>
      <div v-if="err" class="small" style="color:#9B5656">{{ err }}</div>
      <button class="btn" style="height:40px;width:100%" :disabled="loading" @click="submit">
        {{ loading ? '登录中…' : '登 录' }}
      </button>
    </div>

    <div class="login-tip">
      请使用门店分配的账号登录<br />
      忘记密码请联系门店管理员重置
    </div>
  </div>
</div>
`
  }
});
