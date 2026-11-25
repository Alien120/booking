/* 预约日历：一周 × 时段 矩阵，点击可跳转当日看板 */
window.Views = Object.assign(window.Views || {}, {
  calendar: {
    data() {
      return {
        util: window.AdminUtil,
        startDate: window.AdminUtil.today(),
        days: [],
        timeRows: [],
        loading: false
      };
    },
    computed: {
      weekLabel() {
        const end = window.AdminUtil.addDays(this.startDate, 6);
        return this.startDate + ' ~ ' + end;
      }
    },
    mounted() {
      this.load();
    },
    methods: {
      async load() {
        this.loading = true;
        const dates = [];
        for (let i = 0; i < 7; i++) dates.push(window.AdminUtil.addDays(this.startDate, i));

        try {
          const results = await Promise.all(
            dates.map((d) => window.AdminAPI.dashboard(d).catch(() => null))
          );

          const dayMap = [];
          const timeSet = new Set();

          results.forEach((res, i) => {
            const date = dates[i];
            const map = {};
            if (res && res.slots) {
              res.slots.forEach((s) => {
                map[s.startTime] = s;
                timeSet.add(s.startTime);
              });
            }
            dayMap.push({
              date: date,
              weekday: this.util.weekday(date),
              mmdd: this.util.mmdd(date),
              isToday: date === this.util.today(),
              count: res ? res.counts.total : 0,
              slots: map
            });
          });

          this.timeRows = Array.from(timeSet).sort();
          this.days = dayMap;
        } catch (e) {
          /* toast */
        } finally {
          this.loading = false;
        }
      },
      shift(n) {
        this.startDate = window.AdminUtil.addDays(this.startDate, n * 7);
        this.load();
      },
      goToday() {
        this.startDate = window.AdminUtil.today();
        this.load();
      },
      cellClass(day, time) {
        const s = day.slots[time];
        if (!s) return 'cal-cell closed';
        if (s.status === 0) return 'cal-cell closed';
        return s.booked >= s.capacity ? 'cal-cell full' : 'cal-cell';
      },
      cellOf(day, time) {
        return day.slots[time];
      },
      openDay(day) {
        location.hash = '#/dashboard';
        window.AdminToast(day.date + ' 的完整时间轴请在看板页查看');
      }
    },
    template: `
<div>
  <div class="card">
    <div class="row-between" style="margin-bottom:16px">
      <div class="row">
        <button class="btn btn-ghost btn-sm" @click="shift(-1)">‹ 上周</button>
        <button class="btn btn-ghost btn-sm" @click="shift(1)">下周 ›</button>
        <button class="btn btn-ghost btn-sm" @click="goToday">本周</button>
        <span class="muted small" style="margin-left:8px">{{ weekLabel }}</span>
      </div>
      <div class="row small muted">
        <span><i class="dot" style="background:#EAF3EA"></i>有预约</span>
        <span style="margin-left:12px"><i class="dot" style="background:#FDF1F1"></i>已满</span>
        <span style="margin-left:12px"><i class="dot" style="background:#F5F3F0"></i>休息/关闭</span>
      </div>
    </div>

    <div v-if="loading" class="loading"><i class="spinner"></i>加载中…</div>

    <div v-else class="cal">
      <div class="cal-h" style="background:#FBF8F4">时间</div>
      <div v-for="d in days" :key="d.date" class="cal-h" :class="{ today: d.isToday }">
        <div>{{ d.weekday }}</div>
        <div style="font-size:11px;color:#9A9188">{{ d.mmdd }}</div>
        <div style="font-size:10.5px;color:#B08050">{{ d.count }} 单</div>
      </div>

      <template v-for="t in timeRows" :key="t">
        <div class="cal-time">{{ t }}</div>
        <div v-for="d in days" :key="d.date + t" :class="cellClass(d, t)" @click="openDay(d)">
          <template v-if="cellOf(d, t) && cellOf(d, t).status !== 0">
            <div v-for="a in cellOf(d, t).appointments.slice(0, 2)" :key="a.id" class="cal-chip" :title="a.customerName + ' · ' + a.serviceName">
              {{ a.customerName }}
            </div>
            <div v-if="cellOf(d, t).appointments.length > 2" class="cal-chip" style="background:#F0EFED;color:#6B6259">
              +{{ cellOf(d, t).appointments.length - 2 }}
            </div>
            <div class="cal-cap">{{ cellOf(d, t).booked }}/{{ cellOf(d, t).capacity }}</div>
          </template>
        </div>
      </template>
    </div>

    <div v-if="!loading && !timeRows.length" class="empty">该周没有生成时段，请检查营业时间设置</div>
  </div>
</div>
`
  }
});
