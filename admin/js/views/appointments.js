/* 预约列表：筛选 / 操作 / 详情抽屉 / 代客下单 / 改约 */
window.Views = Object.assign(window.Views || {}, {
  appointments: {
    data() {
      return {
        util: window.AdminUtil,
        filter: {
          from: window.AdminUtil.today(),
          to: window.AdminUtil.addDays(window.AdminUtil.today(), 7),
          status: '',
          serviceId: '',
          keyword: ''
        },
        statusOptions: [
          { v: '', t: '全部状态' },
          { v: '1', t: '待确认' },
          { v: '2', t: '已确认' },
          { v: '3', t: '已到店' },
          { v: '4', t: '已完成' },
          { v: '5', t: '已取消' },
          { v: '6', t: '未到店' }
        ],
        services: [],
        list: [],
        total: 0,
        page: 1,
        size: 20,
        loading: false,

        detail: null,
        detailLoading: false,

        showCreate: false,
        createForm: { serviceId: '', date: window.AdminUtil.today(), startTime: '', name: '', phone: '', remark: '' },
        createSlots: [],
        creating: false,

        showReschedule: false,
        resForm: { id: 0, serviceId: '', date: '', startTime: '' },
        resSlots: [],
        rescheduling: false
      };
    },
    computed: {
      totalPages() {
        return Math.max(1, Math.ceil(this.total / this.size));
      },
      activeServices() {
        return this.services.filter((s) => s.status === 1);
      }
    },
    async mounted() {
      // 支持 #/appointments?from=2026-11-26&to=2026-11-26 直接定位区间
      const m = /from=(\d{4}-\d{2}-\d{2})/.exec(location.hash);
      if (m) {
        this.filter.from = m[1];
        const m2 = /to=(\d{4}-\d{2}-\d{2})/.exec(location.hash);
        this.filter.to = m2 ? m2[1] : m[1];
      }
      try {
        this.services = await window.AdminAPI.services();
      } catch (e) {
        /* toast */
      }
      this.load();
    },
    methods: {
      async load() {
        this.loading = true;
        try {
          const res = await window.AdminAPI.appointments({
            from: this.filter.from,
            to: this.filter.to,
            status: this.filter.status,
            serviceId: this.filter.serviceId,
            keyword: this.filter.keyword.trim(),
            page: this.page,
            size: this.size
          });
          this.list = res.list;
          this.total = res.total;
        } catch (e) {
          /* toast */
        } finally {
          this.loading = false;
        }
      },
      search() {
        this.page = 1;
        this.load();
      },
      quickDate(kind) {
        const t = window.AdminUtil.today();
        if (kind === 'today') {
          this.filter.from = t;
          this.filter.to = t;
        } else if (kind === 'tomorrow') {
          this.filter.from = window.AdminUtil.addDays(t, 1);
          this.filter.to = this.filter.from;
        } else {
          this.filter.from = window.AdminUtil.addDays(t, -7);
          this.filter.to = t;
        }
        this.page = 1;
        this.load();
      },
      reset() {
        this.filter = { from: window.AdminUtil.today(), to: window.AdminUtil.addDays(window.AdminUtil.today(), 7), status: '', serviceId: '', keyword: '' };
        this.page = 1;
        this.load();
      },
      pageTo(p) {
        if (p < 1 || p > this.totalPages) return;
        this.page = p;
        this.load();
      },

      // ---------------- 详情 ----------------
      async openDetail(id) {
        this.detailLoading = true;
        this.detail = { id: id };
        try {
          this.detail = await window.AdminAPI.appointment(id);
        } catch (e) {
          this.detail = null;
        } finally {
          this.detailLoading = false;
        }
      },
      closeDetail() {
        this.detail = null;
      },

      // ---------------- 操作 ----------------
      async doAction(id, action, label) {
        try {
          await window.AdminAPI.appointmentAction(id, action);
          window.AdminToast(label + '成功');
          this.afterChange(id);
        } catch (e) {
          /* toast */
        }
      },
      async cancelAppt(id) {
        const reason = prompt('请输入取消原因（会记入日志）', '客人电话取消');
        if (reason === null) return;
        try {
          await window.AdminAPI.cancelAppointment(id, reason || '门店取消');
          window.AdminToast('已取消，名额已释放');
          this.afterChange(id);
        } catch (e) {
          /* toast */
        }
      },
      afterChange(id) {
        this.load();
        if (this.detail && this.detail.id === id) this.openDetail(id);
      },

      // ---------------- 代客下单 ----------------
      async openCreate() {
        if (!this.activeServices.length) {
          window.AdminToast('请先在「服务项目」中配置可预约项目', 'err');
          return;
        }
        this.createForm = {
          serviceId: this.activeServices[0].id,
          date: window.AdminUtil.today(),
          startTime: '',
          name: '',
          phone: '',
          remark: ''
        };
        this.showCreate = true;
        await this.loadCreateSlots();
      },
      async loadCreateSlots() {
        this.createSlots = [];
        this.createForm.startTime = '';
        if (!this.createForm.serviceId || !this.createForm.date) return;
        try {
          const res = await window.AdminAPI.slots(this.createForm.date, this.createForm.serviceId);
          this.createSlots = res.closed
            ? []
            : res.slots.map((s) => ({
                time: s.startTime,
                available: s.available,
                label: s.reason === 'full' ? '已满' : s.reason === 'expired' ? '已过' : '余' + (s.capacity - s.booked)
              }));
        } catch (e) {
          /* toast */
        }
      },
      async submitCreate() {
        const f = this.createForm;
        if (!f.name.trim()) return window.AdminToast('请填写客人姓名', 'err');
        if (!/^1[3-9]\d{9}$/.test(f.phone)) return window.AdminToast('请输入正确的手机号', 'err');
        if (!f.startTime) return window.AdminToast('请选择时间点', 'err');
        this.creating = true;
        try {
          await window.AdminAPI.createAppointment({
            serviceId: Number(f.serviceId),
            date: f.date,
            startTime: f.startTime,
            name: f.name.trim(),
            phone: f.phone,
            remark: f.remark
          });
          window.AdminToast('已代客下单');
          this.showCreate = false;
          this.filter.from = f.date;
          this.filter.to = f.date;
          this.page = 1;
          this.load();
        } catch (e) {
          /* toast */
        } finally {
          this.creating = false;
        }
      },

      // ---------------- 改约 ----------------
      async openReschedule(row) {
        this.resForm = {
          id: row.id,
          serviceId: this.services.find((s) => s.name === row.serviceName)?.id || (this.activeServices[0] || {}).id,
          date: row.date,
          startTime: ''
        };
        this.showReschedule = true;
        await this.loadResSlots();
      },
      async loadResSlots() {
        this.resSlots = [];
        this.resForm.startTime = '';
        if (!this.resForm.serviceId || !this.resForm.date) return;
        try {
          const res = await window.AdminAPI.slots(this.resForm.date, this.resForm.serviceId);
          this.resSlots = res.closed
            ? []
            : res.slots.map((s) => ({
                time: s.startTime,
                available: s.available,
                label: s.reason === 'full' ? '已满' : s.reason === 'expired' ? '已过' : '余' + (s.capacity - s.booked)
              }));
        } catch (e) {
          /* toast */
        }
      },
      async submitReschedule() {
        if (!this.resForm.startTime) return window.AdminToast('请选择新的时间点', 'err');
        this.rescheduling = true;
        try {
          await window.AdminAPI.rescheduleAppointment(this.resForm.id, this.resForm.date, this.resForm.startTime);
          window.AdminToast('改约成功');
          this.showReschedule = false;
          this.afterChange(this.resForm.id);
        } catch (e) {
          /* toast */
        } finally {
          this.rescheduling = false;
        }
      },

      exportCsv() {
        window.AdminAPI.exportAppointments({
          from: this.filter.from,
          to: this.filter.to,
          status: this.filter.status,
          serviceId: this.filter.serviceId,
          keyword: this.filter.keyword.trim()
        });
      },

      sourceText(s) {
        return { 1: '小程序', 2: '后台代录', 3: '改约' }[s] || '—';
      },
      tagClass(s) {
        return window.AdminUtil.statusTag(s);
      }
    },
    template: `
<div>
  <div class="card">
    <div class="row" style="flex-wrap:wrap;gap:12px;align-items:flex-end">
      <div class="field" style="width:150px">
        <label class="field-label">开始日期</label>
        <input class="input" type="date" v-model="filter.from" @change="search" />
      </div>
      <div class="field" style="width:150px">
        <label class="field-label">结束日期</label>
        <input class="input" type="date" v-model="filter.to" @change="search" />
      </div>
      <div class="field" style="width:130px">
        <label class="field-label">状态</label>
        <select class="select" v-model="filter.status" @change="search">
          <option v-for="o in statusOptions" :key="o.v" :value="o.v">{{ o.t }}</option>
        </select>
      </div>
      <div class="field" style="width:150px">
        <label class="field-label">服务项目</label>
        <select class="select" v-model="filter.serviceId" @change="search">
          <option value="">全部项目</option>
          <option v-for="s in services" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
        </select>
      </div>
      <div class="field" style="width:190px">
        <label class="field-label">客户姓名 / 手机尾号</label>
        <input class="input" v-model="filter.keyword" placeholder="如 李 或 8001" @keyup.enter="search" />
      </div>
      <button class="btn" @click="search">查询</button>
      <button class="btn btn-ghost" @click="reset">重置</button>
      <div class="spacer"></div>
      <button class="btn btn-ghost" @click="exportCsv">导出 CSV</button>
      <button class="btn" @click="openCreate">＋ 代客下单</button>
    </div>

    <div class="row" style="margin-top:12px;gap:8px">
      <span class="muted small">快捷：</span>
      <button class="btn btn-ghost btn-xs" @click="quickDate('today')">今天</button>
      <button class="btn btn-ghost btn-xs" @click="quickDate('tomorrow')">明天</button>
      <button class="btn btn-ghost btn-xs" @click="quickDate('week')">近 7 天</button>
      <div class="spacer"></div>
      <span class="muted small">共 {{ total }} 条</span>
    </div>
  </div>

  <div class="card">
    <div v-if="loading" class="loading"><i class="spinner"></i>加载中…</div>
    <div v-else-if="!list.length" class="empty">该条件下没有预约记录</div>
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th style="width:150px">预约时间</th>
            <th style="width:130px">客户</th>
            <th>服务项目</th>
            <th style="width:80px">状态</th>
            <th style="width:80px">来源</th>
            <th style="width:120px">预约号</th>
            <th style="width:260px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in list" :key="a.id">
            <td class="mono">
              <span class="td-strong">{{ util.mmdd(a.date) }}</span>
              <span class="muted small" style="margin-left:4px">{{ util.friendlyDay(a.date) }}</span>
              <div class="small muted">{{ a.startTime }} - {{ a.endTime }}</div>
            </td>
            <td>
              <div class="td-strong">{{ a.customer.name }}</div>
              <div class="small muted mono">***{{ a.customer.phoneTail }}</div>
            </td>
            <td>
              {{ a.serviceName }}
              <span v-if="a.slotCount > 1" class="tag tag-gray" style="margin-left:5px">{{ a.slotCount }} 时段</span>
              <div v-if="a.remark" class="small muted" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                {{ a.remark }}
              </div>
            </td>
            <td><span class="tag" :class="tagClass(a.status)">{{ a.statusText }}</span></td>
            <td class="small muted">{{ sourceText(a.source) }}</td>
            <td class="small mono muted">{{ a.appointmentNo }}</td>
            <td>
              <div class="td-actions">
                <button class="btn btn-xs btn-ghost" @click="openDetail(a.id)">详情</button>
                <button v-if="a.canArrive" class="btn btn-xs" @click="doAction(a.id, 'arrive', '核销')">到店</button>
                <button v-if="a.status === 3" class="btn btn-xs" @click="doAction(a.id, 'finish', '完成')">完成</button>
                <button v-if="a.canReschedule" class="btn btn-xs btn-ghost" @click="openReschedule(a)">改约</button>
                <button v-if="a.canCancel" class="btn btn-xs btn-ghost" @click="cancelAppt(a.id)">取消</button>
                <button v-if="a.canNoShow" class="btn btn-xs btn-ghost" @click="doAction(a.id, 'noshow', '标记未到店')">未到</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="pager">
        <button class="btn btn-ghost btn-xs" :disabled="page <= 1" @click="pageTo(page - 1)">上一页</button>
        <span>{{ page }} / {{ totalPages }}</span>
        <button class="btn btn-ghost btn-xs" :disabled="page >= totalPages" @click="pageTo(page + 1)">下一页</button>
      </div>
    </div>
  </div>

  <!-- 详情抽屉 -->
  <template v-if="detail">
    <div class="drawer-mask" @click="closeDetail"></div>
    <div class="drawer">
      <div class="drawer-head">
        <div class="modal-title">预约详情</div>
        <button class="modal-close" @click="closeDetail">×</button>
      </div>
      <div class="drawer-body">
        <div v-if="detailLoading" class="loading"><i class="spinner"></i>加载中…</div>
        <template v-else>
          <div class="row-between" style="margin-bottom:16px">
            <div>
              <div style="font-size:19px;font-weight:600">{{ detail.date }} {{ detail.startTime }} - {{ detail.endTime }}</div>
              <div class="small muted" style="margin-top:4px">{{ detail.appointmentNo }}</div>
            </div>
            <span class="tag" :class="tagClass(detail.status)">{{ detail.statusText }}</span>
          </div>

          <table class="table" style="margin-bottom:18px">
            <tbody>
              <tr><td class="muted" style="width:90px">客户</td><td>{{ detail.customer.name }}（{{ detail.customer.phoneTail ? '***'+detail.customer.phoneTail : '—' }}）</td></tr>
              <tr><td class="muted">服务项目</td><td>{{ detail.serviceName }}</td></tr>
              <tr><td class="muted">备注</td><td>{{ detail.remark || '—' }}</td></tr>
              <tr><td class="muted">改约次数</td><td>{{ detail.rescheduleCount }}</td></tr>
              <tr v-if="detail.cancelReason"><td class="muted">取消原因</td><td>{{ detail.cancelReason }}</td></tr>
            </tbody>
          </table>

          <div class="card-title" style="margin-bottom:10px">状态流转</div>
          <div class="small" style="line-height:2;color:#5A5148">
            <div v-for="(l, i) in detail.logs" :key="i">
              <span class="muted mono">{{ l.createdAt }}</span>
              <span style="margin:0 6px">·</span>{{ l.operatorText }}
              <span v-if="l.fromStatus">将状态从「{{ l.toStatusText }}」...</span>
              <span v-else>创建为「{{ l.toStatusText }}」</span>
              <span v-if="l.remark" class="muted">（{{ l.remark }}）</span>
            </div>
            <div v-if="!detail.logs.length" class="muted">暂无记录</div>
          </div>

          <div class="card-title" style="margin:18px 0 10px">提醒记录</div>
          <div class="small" style="line-height:2;color:#5A5148">
            <div v-for="(r, i) in detail.reminders" :key="i">
              <span class="mono muted">{{ r.planAt }}</span>
              <span style="margin:0 6px">·</span>{{ r.channel }}
              <span class="tag" :class="r.status === 1 ? 'tag-green' : r.status === 2 ? 'tag-red' : 'tag-gray'" style="margin-left:6px">{{ r.statusText }}</span>
              <span v-if="r.failReason" class="muted">（{{ r.failReason }}）</span>
            </div>
            <div v-if="!detail.reminders.length" class="muted">暂无提醒任务</div>
          </div>
        </template>
      </div>
      <div class="drawer-foot">
        <button v-if="detail && detail.status === 2" class="btn btn-ghost" @click="doAction(detail.id, 'arrive', '核销')">核销到店</button>
        <button v-if="detail && detail.status === 3" class="btn btn-ghost" @click="doAction(detail.id, 'finish', '完成')">完成服务</button>
        <button class="btn btn-ghost" @click="closeDetail">关闭</button>
      </div>
    </div>
  </template>

  <!-- 代客下单 -->
  <div v-if="showCreate" class="modal-mask" @click.self="showCreate = false">
    <div class="modal modal-lg">
      <div class="modal-head">
        <div class="modal-title">代客下单</div>
        <button class="modal-close" @click="showCreate = false">×</button>
      </div>
      <div class="modal-body">
        <div class="form-grid-3" style="margin-bottom:14px">
          <div class="field">
            <label class="field-label">服务项目 <span class="req">*</span></label>
            <select class="select" v-model="createForm.serviceId" @change="loadCreateSlots">
              <option v-for="s in activeServices" :key="s.id" :value="s.id">{{ s.name }}（{{ s.durationMinutes }} 分钟）</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">日期 <span class="req">*</span></label>
            <input class="input" type="date" v-model="createForm.date" @change="loadCreateSlots" />
          </div>
          <div class="field">
            <label class="field-label">时间点 <span class="req">*</span></label>
            <select class="select" v-model="createForm.startTime">
              <option value="">请选择</option>
              <option v-for="s in createSlots" :key="s.time" :value="s.time" :disabled="!s.available">
                {{ s.time }}（{{ s.label }}）
              </option>
            </select>
          </div>
        </div>
        <div class="form-grid" style="margin-bottom:14px">
          <div class="field">
            <label class="field-label">客人姓名 <span class="req">*</span></label>
            <input class="input" v-model="createForm.name" placeholder="如 李女士" />
          </div>
          <div class="field">
            <label class="field-label">手机号 <span class="req">*</span></label>
            <input class="input" v-model="createForm.phone" maxlength="11" placeholder="11 位手机号" />
          </div>
        </div>
        <div class="field">
          <label class="field-label">备注</label>
          <textarea class="textarea" rows="2" v-model="createForm.remark" placeholder="发质、偏好、过敏等"></textarea>
        </div>
        <div class="small muted" style="margin-top:12px">
          提示：同手机号存在客户档案时会自动关联；不存在则创建新档案，客人下次扫码可自动合并。
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" @click="showCreate = false">取消</button>
        <button class="btn" :disabled="creating" @click="submitCreate">{{ creating ? '提交中…' : '确认下单' }}</button>
      </div>
    </div>
  </div>

  <!-- 改约 -->
  <div v-if="showReschedule" class="modal-mask" @click.self="showReschedule = false">
    <div class="modal">
      <div class="modal-head">
        <div class="modal-title">改约时间</div>
        <button class="modal-close" @click="showReschedule = false">×</button>
      </div>
      <div class="modal-body">
        <div class="form-grid" style="margin-bottom:14px">
          <div class="field">
            <label class="field-label">日期</label>
            <input class="input" type="date" v-model="resForm.date" @change="loadResSlots" />
          </div>
          <div class="field">
            <label class="field-label">时间点</label>
            <select class="select" v-model="resForm.startTime">
              <option value="">请选择</option>
              <option v-for="s in resSlots" :key="s.time" :value="s.time" :disabled="!s.available">
                {{ s.time }}（{{ s.label }}）
              </option>
            </select>
          </div>
        </div>
        <div class="small muted">改约占用新时段名额并释放原时段，操作记录会计入日志与统计。</div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" @click="showReschedule = false">取消</button>
        <button class="btn" :disabled="rescheduling" @click="submitReschedule">{{ rescheduling ? '处理中…' : '确认改约' }}</button>
      </div>
    </div>
  </div>
</div>
`
  }
});
