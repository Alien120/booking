/* 账号权限 + 审计日志 */
window.Views = Object.assign(window.Views || {}, {
  users: {
    data() {
      return {
        users: [],
        logs: [],
        logTotal: 0,
        logPage: 1,
        loading: false,
        showForm: false,
        form: { id: 0, username: '', password: '', name: '', role: 3 },
        auditLoading: false
      };
    },
    computed: {
      logPages() {
        return Math.max(1, Math.ceil(this.logTotal / 30));
      }
    },
    mounted() {
      this.load();
      this.loadLogs();
    },
    methods: {
      async load() {
        this.loading = true;
        try {
          this.users = await window.AdminAPI.users();
        } catch (e) {
          /* toast */
        } finally {
          this.loading = false;
        }
      },
      async loadLogs() {
        this.auditLoading = true;
        try {
          const res = await window.AdminAPI.auditLogs(this.logPage);
          this.logs = res.list;
          this.logTotal = res.total;
        } catch (e) {
          /* toast */
        } finally {
          this.auditLoading = false;
        }
      },
      openNew() {
        this.form = { id: 0, username: '', password: '', name: '', role: 3 };
        this.showForm = true;
      },
      openEdit(u) {
        this.form = { id: u.id, username: u.username, password: '', name: u.name, role: u.role };
        this.showForm = true;
      },
      async save() {
        const f = this.form;
        if (f.id) {
          const body = { name: f.name, role: Number(f.role) };
          if (f.password) {
            if (f.password.length < 8) return window.AdminToast('密码至少 8 位', 'err');
            body.password = f.password;
          }
          try {
            await window.AdminAPI.updateUser(f.id, body);
            window.AdminToast('已保存');
            this.showForm = false;
            this.load();
          } catch (e) {
            /* toast */
          }
          return;
        }

        if (!/^[a-zA-Z0-9_]{3,20}$/.test(f.username)) {
          return window.AdminToast('账号需为 3-20 位字母、数字或下划线', 'err');
        }
        if (!f.password || f.password.length < 8) return window.AdminToast('密码至少 8 位', 'err');
        try {
          await window.AdminAPI.createUser({
            username: f.username,
            password: f.password,
            name: f.name || f.username,
            role: Number(f.role)
          });
          window.AdminToast('账号已创建');
          this.showForm = false;
          this.load();
        } catch (e) {
          /* toast */
        }
      },
      async toggleStatus(u) {
        try {
          await window.AdminAPI.updateUser(u.id, { status: u.status === 1 ? 0 : 1 });
          this.load();
        } catch (e) {
          /* toast */
        }
      },
      logPageTo(p) {
        if (p < 1 || p > this.logPages) return;
        this.logPage = p;
        this.loadLogs();
      },
      actionText(a) {
        const map = {
          'appointment.confirm': '确认预约',
          'appointment.arrive': '核销到店',
          'appointment.finish': '完成服务',
          'appointment.noshow': '标记未到店',
          'appointment.cancel': '取消预约',
          'appointment.reschedule': '改约',
          'appointment.createByStaff': '代客下单',
          'customer.update': '编辑客户',
          'customer.revealPhone': '查看完整手机号',
          'user.create': '新增账号',
          'user.update': '修改账号'
        };
        return map[a] || a;
      }
    },
    template: `
<div>
  <div class="card">
    <div class="row-between">
      <div>
        <div class="card-title">账号与权限</div>
        <div class="card-sub">管理员拥有全部权限；店长可配置门店与服务；店员仅可处理预约与客户</div>
      </div>
      <button class="btn" @click="openNew">＋ 新增账号</button>
    </div>
  </div>

  <div class="card">
    <div v-if="loading" class="loading"><i class="spinner"></i>加载中…</div>
    <table v-else class="table">
      <thead>
        <tr>
          <th style="width:140px">账号</th><th style="width:120px">姓名</th><th style="width:100px">角色</th>
          <th style="width:100px">状态</th><th style="width:170px">最后登录</th><th style="width:160px">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td class="td-strong mono">{{ u.username }}</td>
          <td>{{ u.name }}</td>
          <td><span class="tag" :class="u.role === 1 ? 'tag-red' : u.role === 2 ? 'tag-orange' : 'tag-gray'">{{ u.roleText }}</span></td>
          <td><span class="tag" :class="u.status === 1 ? 'tag-green' : 'tag-gray'">{{ u.status === 1 ? '启用' : '停用' }}</span></td>
          <td class="small muted">{{ u.lastLoginAt || '—' }}</td>
          <td>
            <div class="td-actions">
              <button class="btn btn-xs btn-ghost" @click="openEdit(u)">编辑</button>
              <button class="btn btn-xs btn-ghost" @click="toggleStatus(u)">{{ u.status === 1 ? '停用' : '启用' }}</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="card">
    <div class="card-head">
      <div>
        <div class="card-title">操作审计</div>
        <div class="card-sub">敏感操作留痕，便于追溯</div>
      </div>
      <button class="btn btn-ghost btn-sm" @click="loadLogs">刷新</button>
    </div>

    <div v-if="auditLoading" class="loading"><i class="spinner"></i>加载中…</div>
    <div v-else-if="!logs.length" class="empty">暂无操作记录</div>
    <div v-else class="table-wrap">
      <table class="table">
        <thead><tr><th style="width:170px">时间</th><th style="width:110px">操作人</th><th style="width:150px">操作</th><th>对象</th></tr></thead>
        <tbody>
          <tr v-for="l in logs" :key="l.id">
            <td class="small mono muted">{{ l.createdAt }}</td>
            <td class="small">{{ l.adminName }}</td>
            <td class="small">{{ actionText(l.action) }}</td>
            <td class="small muted">{{ l.targetType }} #{{ l.targetId }}</td>
          </tr>
        </tbody>
      </table>
      <div class="pager">
        <button class="btn btn-ghost btn-xs" :disabled="logPage <= 1" @click="logPageTo(logPage - 1)">上一页</button>
        <span>{{ logPage }} / {{ logPages }}</span>
        <button class="btn btn-ghost btn-xs" :disabled="logPage >= logPages" @click="logPageTo(logPage + 1)">下一页</button>
      </div>
    </div>
  </div>

  <div v-if="showForm" class="modal-mask" @click.self="showForm = false">
    <div class="modal">
      <div class="modal-head">
        <div class="modal-title">{{ form.id ? '编辑账号' : '新增账号' }}</div>
        <button class="modal-close" @click="showForm = false">×</button>
      </div>
      <div class="modal-body">
        <div class="col">
          <div class="field">
            <label class="field-label">账号 <span v-if="!form.id" class="req">*</span></label>
            <input class="input" v-model="form.username" :disabled="!!form.id" placeholder="3-20 位字母数字下划线" />
          </div>
          <div class="field">
            <label class="field-label">姓名</label>
            <input class="input" v-model="form.name" placeholder="如 小美" />
          </div>
          <div class="field">
            <label class="field-label">{{ form.id ? '重置密码（留空则不修改）' : '初始密码' }} <span v-if="!form.id" class="req">*</span></label>
            <input class="input" type="password" v-model="form.password" placeholder="至少 8 位" />
          </div>
          <div class="field">
            <label class="field-label">角色</label>
            <select class="select" v-model="form.role">
              <option :value="1">管理员（全部权限）</option>
              <option :value="2">店长（门店设置 + 数据）</option>
              <option :value="3">店员（预约与客户）</option>
            </select>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" @click="showForm = false">取消</button>
        <button class="btn" @click="save">保存</button>
      </div>
    </div>
  </div>
</div>
`
  }
});
