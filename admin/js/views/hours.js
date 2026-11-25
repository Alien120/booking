/* 营业时间 + 门店参数 + 特殊日期 */
window.Views = Object.assign(window.Views || {}, {
  hours: {
    data() {
      return {
        util: window.AdminUtil,
        week: [],
        store: {},
        specialDates: [],
        loading: false,
        savingWeek: false,
        savingStore: false,
        canEditStore: false,
        storeInfo: { name: '', address: '', phone: '', notice: '', bookingRuleText: '' },
        savingInfo: false,
        showSpecial: false,
        specialForm: { date: '', type: 1, openTime: '10:00', closeTime: '18:00', capacity: '', remark: '' }
      };
    },
    mounted() {
      const role = (window.AdminState.user && window.AdminState.user.role) || 3;
      this.canEditStore = role <= 1;
      this.load();
    },
    methods: {
      async load() {
        this.loading = true;
        try {
          const [res, special] = await Promise.all([
            window.AdminAPI.businessHours(),
            window.AdminAPI.specialDates().catch(() => [])
          ]);
          this.week = res.week.map((w) => ({ ...w, capacity: w.capacity === null ? '' : w.capacity }));
          this.store = res.store;
          this.specialDates = special;
          this.storeInfo = {
            name: res.store.name || '',
            address: res.store.address || '',
            phone: res.store.phone || '',
            notice: res.store.notice || '',
            bookingRuleText: res.store.bookingRuleText || ''
          };
          if (window.AdminState.store) {
            window.AdminState.store.slotMinutes = res.store.slotMinutes;
          }
        } catch (e) {
          /* toast */
        } finally {
          this.loading = false;
        }
      },
      async saveWeek() {
        for (const d of this.week) {
          if (d.isOpen && d.closeTime <= d.openTime) {
            return window.AdminToast(d.weekdayText + ' 的打烊时间必须晚于营业时间', 'err');
          }
        }
        this.savingWeek = true;
        try {
          const res = await window.AdminAPI.saveBusinessHours(
            this.week.map((d) => ({
              weekday: d.weekday,
              isOpen: d.isOpen,
              openTime: d.openTime,
              closeTime: d.closeTime,
              capacity: d.capacity === '' ? null : Number(d.capacity)
            }))
          );
          this.week = res.week.map((w) => ({ ...w, capacity: w.capacity === null ? '' : w.capacity }));
          this.store = res.store;
          window.AdminToast('已保存，未来未占用时段的容量已同步');
        } catch (e) {
          /* toast */
        } finally {
          this.savingWeek = false;
        }
      },
      async saveInfo() {
        const f = this.storeInfo;
        if (!f.name.trim()) return window.AdminToast('门店名称不能为空', 'err');
        this.savingInfo = true;
        try {
          const res = await window.AdminAPI.saveStoreSettings({
            name: f.name.trim(),
            address: f.address.trim(),
            phone: f.phone.trim(),
            notice: f.notice,
            bookingRuleText: f.bookingRuleText
          });
          this.store = res.store;
          window.AdminUpdateStore({ name: res.store.name });
          window.AdminToast('门店信息已保存，客户端刷新后生效');
        } catch (e) {
          /* toast */
        } finally {
          this.savingInfo = false;
        }
      },
      async saveStore() {
        this.savingStore = true;
        try {
          const res = await window.AdminAPI.saveStoreSettings({
            advanceDays: Number(this.store.advanceDays),
            minAdvanceHours: Number(this.store.minAdvanceHours),
            cancelDeadlineHours: Number(this.store.cancelDeadlineHours),
            rescheduleLimit: Number(this.store.rescheduleLimit),
            slotMinutes: Number(this.store.slotMinutes),
            defaultCapacity: Number(this.store.defaultCapacity),
            dailyLimitPerCustomer: Number(this.store.dailyLimitPerCustomer),
            phoneDailyLimit: Number(this.store.phoneDailyLimit)
          });
          this.store = res.store;
          window.AdminToast('门店规则已保存');
        } catch (e) {
          /* toast */
        } finally {
          this.savingStore = false;
        }
      },
      async addSpecial() {
        const f = this.specialForm;
        if (!f.date) return window.AdminToast('请选择日期', 'err');
        try {
          await window.AdminAPI.addSpecialDate({
            date: f.date,
            type: Number(f.type),
            openTime: Number(f.type) === 2 ? f.openTime : undefined,
            closeTime: Number(f.type) === 2 ? f.closeTime : undefined,
            capacity: f.capacity === '' ? undefined : Number(f.capacity),
            remark: f.remark
          });
          window.AdminToast('已添加');
          this.showSpecial = false;
          this.specialForm = { date: '', type: 1, openTime: '10:00', closeTime: '18:00', capacity: '', remark: '' };
          this.load();
        } catch (e) {
          /* toast */
        }
      },
      async removeSpecial(row) {
        if (!confirm('确认删除 ' + row.date + ' 的特殊设置？')) return;
        try {
          await window.AdminAPI.removeSpecialDate(row.id);
          window.AdminToast('已删除');
          this.load();
        } catch (e) {
          /* toast */
        }
      }
    },
    template: `
<div>
  <div class="card">
    <div class="card-head">
      <div>
        <div class="card-title">门店信息</div>
        <div class="card-sub">展示在客人扫码后的首页；地址与电话留空则客户端不显示</div>
      </div>
      <button v-if="canEditStore" class="btn" :disabled="savingInfo" @click="saveInfo">
        {{ savingInfo ? '保存中…' : '保存门店信息' }}
      </button>
    </div>

    <div class="form-grid">
      <div class="field">
        <label class="field-label">门店名称 <span class="req">*</span></label>
        <input class="input" v-model="storeInfo.name" :disabled="!canEditStore" />
      </div>
      <div class="field">
        <label class="field-label">门店电话（留空不显示）</label>
        <input class="input" v-model="storeInfo.phone" :disabled="!canEditStore" placeholder="如 0756-8888888" />
      </div>
      <div class="field" style="grid-column:span 2">
        <label class="field-label">门店地址（留空不显示）</label>
        <input class="input" v-model="storeInfo.address" :disabled="!canEditStore"
               placeholder="填写后小程序首页显示地址，并支持一键导航" />
      </div>
      <div class="field" style="grid-column:span 2">
        <label class="field-label">到店须知（显示在首页公告条）</label>
        <textarea class="textarea" rows="2" v-model="storeInfo.notice" :disabled="!canEditStore"></textarea>
      </div>
      <div class="field" style="grid-column:span 2">
        <label class="field-label">预约规则文案（首页「预约须知」折叠区）</label>
        <textarea class="textarea" rows="2" v-model="storeInfo.bookingRuleText" :disabled="!canEditStore"></textarea>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <div>
        <div class="card-title">每周营业时间</div>
        <div class="card-sub">时段会按「时段粒度」自动切分；此处容量留空则使用门店默认值</div>
      </div>
      <button class="btn" :disabled="savingWeek" @click="saveWeek">{{ savingWeek ? '保存中…' : '保存营业时间' }}</button>
    </div>

    <div v-if="loading" class="loading"><i class="spinner"></i>加载中…</div>
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th style="width:100px">星期</th>
            <th style="width:90px">营业</th>
            <th style="width:140px">开始时间</th>
            <th style="width:140px">打烊时间</th>
            <th style="width:160px">每时段可接待</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in week" :key="d.weekday">
            <td class="td-strong">{{ d.weekdayText }}</td>
            <td><button class="switch" :class="{ on: d.isOpen }" @click="d.isOpen = !d.isOpen"></button></td>
            <td><input class="input" type="time" v-model="d.openTime" :disabled="!d.isOpen" style="width:120px" /></td>
            <td><input class="input" type="time" v-model="d.closeTime" :disabled="!d.isOpen" style="width:120px" /></td>
            <td>
              <input class="input" type="number" v-model="d.capacity" :disabled="!d.isOpen"
                     :placeholder="'默认 ' + (store.defaultCapacity || 3)" min="1" max="50" style="width:110px" />
            </td>
            <td class="small muted">{{ d.isOpen ? '' : '休息' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <div>
        <div class="card-title">预约规则</div>
        <div class="card-sub">修改后立即对客户端生效{{ canEditStore ? '' : '（仅管理员可修改）' }}</div>
      </div>
      <button v-if="canEditStore" class="btn" :disabled="savingStore" @click="saveStore">
        {{ savingStore ? '保存中…' : '保存规则' }}
      </button>
    </div>

    <div class="form-grid-3" v-if="!loading">
      <div class="field">
        <label class="field-label">时段粒度（分钟）</label>
        <input class="input" type="number" v-model="store.slotMinutes" :disabled="!canEditStore" />
      </div>
      <div class="field">
        <label class="field-label">默认每时段可接待（人）</label>
        <input class="input" type="number" v-model="store.defaultCapacity" :disabled="!canEditStore" />
      </div>
      <div class="field">
        <label class="field-label">最早可提前（天）</label>
        <input class="input" type="number" v-model="store.advanceDays" :disabled="!canEditStore" />
      </div>
      <div class="field">
        <label class="field-label">最晚需提前（小时）</label>
        <input class="input" type="number" step="0.5" v-model="store.minAdvanceHours" :disabled="!canEditStore" />
      </div>
      <div class="field">
        <label class="field-label">自助取消截止（小时）</label>
        <input class="input" type="number" step="0.5" v-model="store.cancelDeadlineHours" :disabled="!canEditStore" />
      </div>
      <div class="field">
        <label class="field-label">单笔最多改约（次）</label>
        <input class="input" type="number" v-model="store.rescheduleLimit" :disabled="!canEditStore" />
      </div>
      <div class="field">
        <label class="field-label">单客单日最多预约（个）</label>
        <input class="input" type="number" v-model="store.dailyLimitPerCustomer" :disabled="!canEditStore" />
      </div>
      <div class="field">
        <label class="field-label">同手机号 24h 最多（单）</label>
        <input class="input" type="number" v-model="store.phoneDailyLimit" :disabled="!canEditStore" />
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <div>
        <div class="card-title">特殊日期</div>
        <div class="card-sub">整店休息或临时调整营业时间，优先级高于每周营业时间</div>
      </div>
      <button class="btn btn-ghost" @click="showSpecial = true">＋ 添加特殊日期</button>
    </div>

    <div v-if="!specialDates.length" class="empty">暂无特殊日期</div>
    <table v-else class="table">
      <thead><tr><th style="width:130px">日期</th><th style="width:110px">类型</th><th>时间</th><th>备注</th><th style="width:80px">操作</th></tr></thead>
      <tbody>
        <tr v-for="d in specialDates" :key="d.id">
          <td class="mono">{{ d.date }}</td>
          <td><span class="tag" :class="d.type === 1 ? 'tag-red' : 'tag-green'">{{ d.typeText }}</span></td>
          <td class="small muted">{{ d.type === 2 ? d.openTime + ' - ' + d.closeTime : '—' }}</td>
          <td class="small muted">{{ d.remark || '—' }}</td>
          <td><button class="btn btn-xs btn-ghost" @click="removeSpecial(d)">删除</button></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div v-if="showSpecial" class="modal-mask" @click.self="showSpecial = false">
    <div class="modal">
      <div class="modal-head">
        <div class="modal-title">添加特殊日期</div>
        <button class="modal-close" @click="showSpecial = false">×</button>
      </div>
      <div class="modal-body">
        <div class="col">
          <div class="field">
            <label class="field-label">日期 <span class="req">*</span></label>
            <input class="input" type="date" v-model="specialForm.date" />
          </div>
          <div class="field">
            <label class="field-label">类型</label>
            <select class="select" v-model="specialForm.type">
              <option :value="1">整店休息</option>
              <option :value="2">特殊营业时间</option>
            </select>
          </div>
          <div v-if="Number(specialForm.type) === 2" class="form-grid">
            <div class="field">
              <label class="field-label">开始时间</label>
              <input class="input" type="time" v-model="specialForm.openTime" />
            </div>
            <div class="field">
              <label class="field-label">打烊时间</label>
              <input class="input" type="time" v-model="specialForm.closeTime" />
            </div>
          </div>
          <div class="field">
            <label class="field-label">备注</label>
            <input class="input" v-model="specialForm.remark" placeholder="如 国庆放假 / 店庆延长营业" />
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" @click="showSpecial = false">取消</button>
        <button class="btn" @click="addSpecial">确认添加</button>
      </div>
    </div>
  </div>
</div>
`
  }
});
