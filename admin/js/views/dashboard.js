/* 预约看板：今日指标 + 时间轴，支持一键核销 */
window.Views = Object.assign(window.Views || {}, {
  dashboard: {
    data() {
      return {
        date: window.AdminUtil.today(),
        data: null,
        loading: false,
        timer: null,
        showAllSlots: false
      };
    },
    computed: {
      counts() {
        return (this.data && this.data.counts) || {};
      },
      slots() {
        return (this.data && this.data.slots) || [];
      },
      // 默认只展示有预约的时段，避免店员在上百个空行里翻找
      visibleSlots() {
        if (this.showAllSlots) return this.slots;
        return this.slots.filter((s) => s.appointments.length > 0);
      },
      dateLabel() {
        return window.AdminUtil.friendlyDay(this.date) + ' ' + this.date + ' ' + window.AdminUtil.weekday(this.date);
      },
      isToday() {
        return this.date === window.AdminUtil.today();
      },
      // 时间轴只展示待处理预约；若当日单都已结束，需要一句解释避免误以为数据丢了
      detailHint() {
        const c = this.counts;
        const active = (c.pending || 0) + (c.arrived || 0);
        if ((c.total || 0) > 0 && active === 0) {
          return '当日 ' + c.total + ' 单均已结束（已完成 / 取消 / 未到店），时间轴无待服务预约';
        }
        return '';
      }
    },
    mounted() {
      // 支持 #/dashboard?date=2026-11-26 直接定位某天（便于分享与排查）
      const m = /date=(\d{4}-\d{2}-\d{2})/.exec(location.hash);
      if (m) this.date = m[1];
      this.load();
      // 前台常开，60 秒自动刷新一次
      this.timer = setInterval(() => {
        if (this.isToday && !document.hidden) this.load(true);
      }, 60000);
    },
    unmounted() {
      if (this.timer) clearInterval(this.timer);
    },
    methods: {
      async load(silent) {
        if (!silent) this.loading = true;
        try {
          this.data = await window.AdminAPI.dashboard(this.date);
        } catch (e) {
          /* 已 toast */
        } finally {
          this.loading = false;
        }
      },
      shift(n) {
        this.date = window.AdminUtil.addDays(this.date, n);
        this.load();
      },
      goToday() {
        this.date = window.AdminUtil.today();
        this.load();
      },
      pickDate(e) {
        this.date = e.target.value;
        this.load();
      },
      async arrive(id) {
        try {
          await window.AdminAPI.appointmentAction(id, 'arrive');
          window.AdminToast('已核销到店');
          this.load(true);
        } catch (e) {
          /* toast */
        }
      },
      async finish(id) {
        try {
          await window.AdminAPI.appointmentAction(id, 'finish');
          window.AdminToast('已标记完成');
          this.load(true);
        } catch (e) {
          /* toast */
        }
      },
      async noShow(id) {
        if (!confirm('确认标记为「未到店」？该时段名额将被释放。')) return;
        try {
          await window.AdminAPI.appointmentAction(id, 'noshow');
          window.AdminToast('已标记未到店');
          this.load(true);
        } catch (e) {
          /* toast */
        }
      },
      tagClass(s) {
        return window.AdminUtil.statusTag(s);
      }
    },
    template: `
<div>
  <div class="row-between" style="margin-bottom:16px">
    <div class="row">
      <button class="btn btn-ghost btn-sm" @click="shift(-1)">‹ 前一天</button>
      <input class="input" type="date" :value="date" @change="pickDate" style="width:150px" />
      <button class="btn btn-ghost btn-sm" @click="shift(1)">后一天 ›</button>
      <button v-if="!isToday" class="btn btn-ghost btn-sm" @click="goToday">回到今天</button>
      <span class="muted small" style="margin-left:6px">{{ dateLabel }}</span>
    </div>
    <div class="row">
      <span v-if="isToday" class="muted small">每 60 秒自动刷新</span>
      <button class="btn btn-ghost btn-sm" @click="load()">刷新</button>
    </div>
  </div>

  <div class="stat-grid" style="margin-bottom:16px">
    <div class="stat">
      <div class="stat-label">今日预约</div>
      <div class="stat-value">{{ counts.total || 0 }}</div>
      <div class="stat-foot">含已取消、未到店</div>
    </div>
    <div class="stat">
      <div class="stat-label">待服务</div>
      <div class="stat-value" style="color:#A9762A">{{ counts.pending || 0 }}</div>
      <div class="stat-foot">待确认 + 已确认</div>
    </div>
    <div class="stat">
      <div class="stat-label">已到店</div>
      <div class="stat-value" style="color:#3E6285">{{ counts.arrived || 0 }}</div>
      <div class="stat-foot">正在服务中</div>
    </div>
    <div class="stat">
      <div class="stat-label">已完成</div>
      <div class="stat-value" style="color:#3C7A45">{{ counts.done || 0 }}</div>
      <div class="stat-foot">当日收尾</div>
    </div>
    <div class="stat">
      <div class="stat-label">已取消 / 未到店</div>
      <div class="stat-value" style="color:#9B5656">{{ (counts.canceled || 0) }} / {{ (counts.noshow || 0) }}</div>
      <div class="stat-foot">名额已释放</div>
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <div>
        <div class="card-title">当日时间轴</div>
        <div class="card-sub">
          按门店时段展示，可直接核销到店
          <span v-if="detailHint" style="color:#A9762A"> · {{ detailHint }}</span>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" @click="showAllSlots = !showAllSlots">
        {{ showAllSlots ? '只看有预约的' : '展开全部时段（' + slots.length + '）' }}
      </button>
    </div>

    <div v-if="loading" class="loading"><i class="spinner"></i>加载中…</div>
    <div v-else-if="!slots.length" class="empty">当日门店休息或未生成时段</div>

    <div v-else-if="!visibleSlots.length" class="empty">
      当日暂无待服务预约
      <div style="margin-top:12px">
        <button class="btn btn-ghost btn-sm" @click="showAllSlots = true">查看全部 {{ slots.length }} 个时段</button>
      </div>
    </div>

    <div v-else class="timeline">
      <div class="tl-row" v-for="s in visibleSlots" :key="s.startTime">
        <div class="tl-time">{{ s.startTime }}</div>
        <div class="tl-body">
          <div class="tl-cap">
            {{ s.booked }} / {{ s.capacity }} 人
            <span v-if="s.booked >= s.capacity" class="tag tag-red" style="margin-left:6px">已满</span>
            <span v-else-if="s.status === 0" class="tag tag-gray" style="margin-left:6px">已关闭</span>
          </div>

          <div v-if="!s.appointments.length" class="small muted" style="padding:2px 0">— 暂无人预约</div>

          <div v-for="a in s.appointments" :key="a.id" class="tl-item" :class="{ done: a.status === 3 }">
            <span class="tl-name">{{ a.customerName }}</span>
            <span class="tl-svc">{{ a.serviceName }}</span>
            <span class="tag" :class="tagClass(a.status)">{{ a.statusText }}</span>
            <span v-if="a.remark" class="small muted" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              备注：{{ a.remark }}
            </span>
            <div class="tl-actions">
              <button v-if="a.status === 1 || a.status === 2" class="btn btn-sm" @click="arrive(a.id)">核销到店</button>
              <button v-if="a.status === 3" class="btn btn-sm btn-ghost" @click="finish(a.id)">完成服务</button>
              <button v-if="a.status === 1 || a.status === 2" class="btn btn-sm btn-ghost" @click="noShow(a.id)">未到店</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
`
  }
});
