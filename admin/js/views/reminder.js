/* 提醒设置：规则 + 发送记录 */
window.Views = Object.assign(window.Views || {}, {
  reminder: {
    data() {
      return {
        util: window.AdminUtil,
        tab: 'rules',
        rules: [],
        jobs: [],
        jobStats: { pending: 0, sent: 0, failed: 0, skipped: 0 },
        jobTotal: 0,
        jobPage: 1,
        jobStatus: '',
        loading: false,
        canEdit: false,
        showForm: false,
        form: { id: 0, name: '', offsetMinutes: 1440, channel: 1, templateId: '' }
      };
    },
    mounted() {
      const role = (window.AdminState.user && window.AdminState.user.role) || 3;
      this.canEdit = role <= 2;
      this.loadRules();
    },
    computed: {
      jobPages() {
        return Math.max(1, Math.ceil(this.jobTotal / 20));
      }
    },
    methods: {
      async loadRules() {
        this.loading = true;
        try {
          this.rules = await window.AdminAPI.reminderRules();
        } catch (e) {
          /* toast */
        } finally {
          this.loading = false;
        }
      },
      async loadJobs() {
        this.loading = true;
        try {
          const res = await window.AdminAPI.reminderJobs({
            status: this.jobStatus,
            page: this.jobPage,
            size: 20
          });
          this.jobs = res.list;
          this.jobStats = res.stats;
          this.jobTotal = res.total;
        } catch (e) {
          /* toast */
        } finally {
          this.loading = false;
        }
      },
      switchTab(t) {
        this.tab = t;
        if (t === 'jobs' && !this.jobs.length) this.loadJobs();
      },
      openNew() {
        this.form = { id: 0, name: '', offsetMinutes: 1440, channel: 1, templateId: '' };
        this.showForm = true;
      },
      openEdit(r) {
        this.form = {
          id: r.id,
          name: r.name,
          offsetMinutes: r.offsetMinutes,
          channel: r.channel,
          templateId: r.templateId || ''
        };
        this.showForm = true;
      },
      async save() {
        if (!this.form.name.trim()) return window.AdminToast('请填写规则名称', 'err');
        try {
          await window.AdminAPI.saveReminderRule({
            id: this.form.id || undefined,
            name: this.form.name.trim(),
            offsetMinutes: Number(this.form.offsetMinutes),
            channel: Number(this.form.channel),
            templateId: this.form.templateId
          });
          window.AdminToast('已保存');
          this.showForm = false;
          this.loadRules();
        } catch (e) {
          /* toast */
        }
      },
      async toggle(r) {
        try {
          await window.AdminAPI.toggleReminderRule(r.id, !r.enabled);
          this.loadRules();
        } catch (e) {
          /* toast */
        }
      },
      async remove(r) {
        if (!confirm('删除规则「' + r.name + '」？已生成的提醒任务不受影响。')) return;
        try {
          await window.AdminAPI.deleteReminderRule(r.id);
          window.AdminToast('已删除');
          this.loadRules();
        } catch (e) {
          /* toast */
        }
      },
      async retry(j) {
        try {
          await window.AdminAPI.retryReminderJob(j.id);
          window.AdminToast('已重新排入发送队列');
          this.loadJobs();
        } catch (e) {
          /* toast */
        }
      },
      async runNow() {
        try {
          const r = await window.AdminAPI.runReminders();
          if (!r.wxConfigured) {
            window.AdminToast('未配置微信 AppID，本次为模拟发送（' + r.total + ' 条）');
          } else {
            window.AdminToast('已处理 ' + r.total + ' 条：成功 ' + r.sent + '，跳过 ' + r.skipped + '，失败 ' + r.failed);
          }
          this.loadJobs();
        } catch (e) {
          /* toast */
        }
      },

      jobPageTo(p) {
        if (p < 1 || p > this.jobPages) return;
        this.jobPage = p;
        this.loadJobs();
      },
      offsetHint(v) {
        const n = Number(v);
        if (n === 0) return '预约成功后立即发送';
        if (n % 1440 === 0) return '提前 ' + n / 1440 + ' 天';
        if (n % 60 === 0) return '提前 ' + n / 60 + ' 小时';
        return '提前 ' + n + ' 分钟';
      }
    },
    template: `
<div>
  <div class="card">
    <div class="row" style="gap:20px;border-bottom:1px solid #EDE6DB;padding-bottom:0;margin-bottom:4px">
      <div class="nav-item" style="padding:10px 2px;color:inherit;cursor:pointer"
           :style="tab === 'rules' ? 'color:#2A2724;font-weight:600;border-bottom:2px solid #C9A063' : 'color:#9A9188'"
           @click="switchTab('rules')">提醒规则</div>
      <div class="nav-item" style="padding:10px 2px;color:inherit;cursor:pointer"
           :style="tab === 'jobs' ? 'color:#2A2724;font-weight:600;border-bottom:2px solid #C9A063' : 'color:#9A9188'"
           @click="switchTab('jobs')">发送记录</div>
    </div>

    <template v-if="tab === 'rules'">
      <div class="row-between" style="margin:14px 0">
        <div class="card-sub">预约成功/临期自动通知客人；微信订阅消息需客人授权，未授权会记为「跳过」</div>
        <button v-if="canEdit" class="btn" @click="openNew">＋ 新增规则</button>
      </div>

      <div v-if="loading" class="loading"><i class="spinner"></i>加载中…</div>
      <div v-else-if="!rules.length" class="empty">还没有提醒规则</div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>规则名称</th><th style="width:140px">触发时机</th><th style="width:140px">渠道</th>
            <th style="width:160px">模板 ID</th><th style="width:90px">启用</th><th style="width:120px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rules" :key="r.id">
            <td class="td-strong">{{ r.name }}</td>
            <td class="small">{{ r.offsetText }}</td>
            <td class="small muted">{{ r.channelText }}</td>
            <td class="small mono muted">{{ r.templateId || '未绑定' }}</td>
            <td><button class="switch" :class="{ on: r.enabled }" :disabled="!canEdit" @click="toggle(r)"></button></td>
            <td>
              <div v-if="canEdit" class="td-actions">
                <button class="btn btn-xs btn-ghost" @click="openEdit(r)">编辑</button>
                <button class="btn btn-xs btn-ghost" @click="remove(r)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="card" style="background:#FDF8F0;border:1px solid #F0E4D0;margin-top:16px">
        <div class="small" style="line-height:2;color:#8A6B3C">
          <strong>关于微信订阅消息的重要说明：</strong><br />
          1. 订阅消息是<strong>一次性授权</strong>，客人在预约时需点「允许」才能收到该条通知，无法保证 100% 触达。<br />
          2. 客人未授权时，发送记录会显示「跳过」，可在「发送记录」中查看原因。<br />
          3. 模板 ID 需在小程序后台「订阅消息」申请后填入，模板内容需包含：姓名、时间、项目、门店地址。
        </div>
      </div>
    </template>

    <template v-else>
      <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);margin:14px 0">
        <div class="stat"><div class="stat-label">待发送</div><div class="stat-value" style="font-size:22px">{{ jobStats.pending }}</div></div>
        <div class="stat"><div class="stat-label">已发送</div><div class="stat-value" style="font-size:22px;color:#3C7A45">{{ jobStats.sent }}</div></div>
        <div class="stat"><div class="stat-label">失败</div><div class="stat-value" style="font-size:22px;color:#9B5656">{{ jobStats.failed }}</div></div>
        <div class="stat"><div class="stat-label">跳过（未授权/已取消）</div><div class="stat-value" style="font-size:22px;color:#9A9188">{{ jobStats.skipped }}</div></div>
      </div>

      <div class="row" style="margin-bottom:12px">
        <select class="select" style="width:160px" v-model="jobStatus" @change="jobPage = 1; loadJobs()">
          <option value="">全部状态</option>
          <option value="0">待发送</option>
          <option value="1">已发送</option>
          <option value="2">失败</option>
          <option value="3">跳过</option>
        </select>
        <button class="btn btn-ghost btn-sm" @click="loadJobs">刷新</button>
        <button v-if="canEdit" class="btn btn-ghost btn-sm" @click="runNow">立即执行一次</button>
        <div class="spacer"></div>
        <span class="muted small">共 {{ jobTotal }} 条</span>
      </div>

      <div v-if="loading" class="loading"><i class="spinner"></i>加载中…</div>
      <div v-else-if="!jobs.length" class="empty">暂无发送记录</div>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th style="width:150px">计划发送</th><th style="width:120px">客户</th><th>规则</th>
              <th style="width:100px">渠道</th><th style="width:90px">状态</th><th>失败原因</th><th style="width:80px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="j in jobs" :key="j.id">
              <td class="mono small">{{ j.planAt }}</td>
              <td class="small">{{ j.customerName }}</td>
              <td class="small muted">{{ j.ruleName }}</td>
              <td class="small muted">{{ j.channelText }}</td>
              <td>
                <span class="tag" :class="j.status === 1 ? 'tag-green' : j.status === 2 ? 'tag-red' : j.status === 3 ? 'tag-gray' : 'tag-orange'">
                  {{ j.statusText }}
                </span>
              </td>
              <td class="small muted">{{ j.failReason || '—' }}</td>
              <td>
                <button v-if="j.status !== 1 && canEdit" class="btn btn-xs btn-ghost" @click="retry(j)">重发</button>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="pager">
          <button class="btn btn-ghost btn-xs" :disabled="jobPage <= 1" @click="jobPageTo(jobPage - 1)">上一页</button>
          <span>{{ jobPage }} / {{ jobPages }}</span>
          <button class="btn btn-ghost btn-xs" :disabled="jobPage >= jobPages" @click="jobPageTo(jobPage + 1)">下一页</button>
        </div>
      </div>
    </template>
  </div>

  <div v-if="showForm" class="modal-mask" @click.self="showForm = false">
    <div class="modal">
      <div class="modal-head">
        <div class="modal-title">{{ form.id ? '编辑提醒规则' : '新增提醒规则' }}</div>
        <button class="modal-close" @click="showForm = false">×</button>
      </div>
      <div class="modal-body">
        <div class="col">
          <div class="field">
            <label class="field-label">规则名称 <span class="req">*</span></label>
            <input class="input" v-model="form.name" placeholder="如 提前 2 小时提醒" maxlength="20" />
          </div>
          <div class="field">
            <label class="field-label">提前多少分钟（0 = 预约成功即时）</label>
            <input class="input" type="number" v-model="form.offsetMinutes" min="0" />
            <div class="small muted">{{ offsetHint(form.offsetMinutes) }}</div>
          </div>
          <div class="field">
            <label class="field-label">渠道</label>
            <select class="select" v-model="form.channel">
              <option :value="1">微信订阅消息</option>
              <option :value="2">公众号模板消息</option>
              <option :value="3">短信（需另行接入）</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">模板 ID</label>
            <input class="input" v-model="form.templateId" placeholder="小程序后台申请的模板 ID" />
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
