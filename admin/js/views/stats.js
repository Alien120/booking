/* 数据统计 */
window.Views = Object.assign(window.Views || {}, {
  stats: {
    data() {
      return {
        util: window.AdminUtil,
        from: window.AdminUtil.addDays(window.AdminUtil.today(), -29),
        to: window.AdminUtil.today(),
        data: null,
        loading: false
      };
    },
    computed: {
      overview() {
        return (this.data && this.data.overview) || {};
      },
      trend() {
        return (this.data && this.data.trend) || [];
      },
      services() {
        return (this.data && this.data.services) || [];
      },
      slots() {
        return (this.data && this.data.slots) || [];
      },
      maxTrend() {
        return Math.max.apply(null, this.trend.map((t) => t.total).concat([1]));
      },
      maxService() {
        return Math.max.apply(null, this.services.map((s) => s.count).concat([1]));
      },
      maxSlot() {
        return Math.max.apply(null, this.slots.map((s) => s.count).concat([1]));
      },
      rangeDays() {
        const a = new Date(this.from.replace(/-/g, '/'));
        const b = new Date(this.to.replace(/-/g, '/'));
        return Math.round((b - a) / 86400000) + 1;
      }
    },
    mounted() {
      this.load();
    },
    methods: {
      async load() {
        if (this.from > this.to) return window.AdminToast('开始日期不能晚于结束日期', 'err');
        this.loading = true;
        try {
          this.data = await window.AdminAPI.stats(this.from, this.to);
        } catch (e) {
          /* toast */
        } finally {
          this.loading = false;
        }
      },
      quick(kind) {
        const t = window.AdminUtil.today();
        if (kind === '7') {
          this.from = window.AdminUtil.addDays(t, -6);
          this.to = t;
        } else if (kind === '30') {
          this.from = window.AdminUtil.addDays(t, -29);
          this.to = t;
        } else if (kind === 'month') {
          this.from = t.slice(0, 8) + '01';
          this.to = t;
        }
        this.load();
      },
      trendH(t) {
        return Math.max(3, Math.round((t.total / this.maxTrend) * 140)) + 'px';
      },
      slotH(s) {
        return Math.max(3, Math.round((s.count / this.maxSlot) * 140)) + 'px';
      },
      showLabel(i) {
        if (this.trend.length <= 10) return true;
        return i % Math.ceil(this.trend.length / 10) === 0;
      }
    },
    template: `
<div>
  <div class="card">
    <div class="row" style="gap:12px;flex-wrap:wrap;align-items:flex-end">
      <div class="field" style="width:150px">
        <label class="field-label">开始日期</label>
        <input class="input" type="date" v-model="from" @change="load" />
      </div>
      <div class="field" style="width:150px">
        <label class="field-label">结束日期</label>
        <input class="input" type="date" v-model="to" @change="load" />
      </div>
      <button class="btn" @click="load">查询</button>
      <button class="btn btn-ghost btn-sm" @click="quick('7')">近 7 天</button>
      <button class="btn btn-ghost btn-sm" @click="quick('30')">近 30 天</button>
      <button class="btn btn-ghost btn-sm" @click="quick('month')">本月</button>
      <div class="spacer"></div>
      <span class="muted small">统计区间 {{ rangeDays }} 天（按预约日期，不含已取消计入总量）</span>
    </div>
  </div>

  <div v-if="loading" class="card"><div class="loading"><i class="spinner"></i>统计中…</div></div>

  <template v-else-if="data">
    <div class="stat-grid" style="margin-top:16px">
      <div class="stat">
        <div class="stat-label">预约总量</div>
        <div class="stat-value">{{ overview.total }}</div>
        <div class="stat-foot">区间内全部预约</div>
      </div>
      <div class="stat">
        <div class="stat-label">到店率</div>
        <div class="stat-value" style="color:#3C7A45">{{ overview.arriveRate }}%</div>
        <div class="stat-foot">到店 + 完成 / 总量</div>
      </div>
      <div class="stat">
        <div class="stat-label">取消率</div>
        <div class="stat-value" style="color:#A9762A">{{ overview.cancelRate }}%</div>
        <div class="stat-foot">已取消 {{ overview.canceled }} 单</div>
      </div>
      <div class="stat">
        <div class="stat-label">未到店率</div>
        <div class="stat-value" style="color:#9B5656">{{ overview.noshowRate }}%</div>
        <div class="stat-foot">未到店 {{ overview.noshow }} 单</div>
      </div>
      <div class="stat">
        <div class="stat-label">新增客户</div>
        <div class="stat-value">{{ overview.newCustomers }}</div>
        <div class="stat-foot">区间内新建档</div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <div class="card-title">预约趋势</div>
          <div class="card-sub">按预约日期统计单量</div>
        </div>
      </div>
      <div v-if="!trend.length" class="empty">该区间没有预约数据</div>
      <div v-else class="bars">
        <div v-for="(t, i) in trend" :key="t.date" class="bar-col">
          <div class="bar" :style="{ height: trendH(t) }" :title="t.date + '：' + t.total + ' 单，完成 ' + t.done + '，取消 ' + t.canceled"></div>
          <div class="bar-label" v-if="showLabel(i)">{{ t.date.slice(5) }}</div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
      <div class="card" style="margin:0">
        <div class="card-head"><div class="card-title">服务项目偏好</div></div>
        <div v-if="!services.length" class="empty">暂无数据</div>
        <div v-else class="rank">
          <div class="rank-row" v-for="s in services" :key="s.name">
            <div class="rank-name">{{ s.name }}</div>
            <div class="rank-bar"><div class="rank-fill" :style="{ width: Math.round((s.count / maxService) * 100) + '%' }"></div></div>
            <div class="rank-val">{{ s.count }}</div>
          </div>
        </div>
      </div>

      <div class="card" style="margin:0">
        <div class="card-head"><div class="card-title">时段热度</div></div>
        <div v-if="!slots.length" class="empty">暂无数据</div>
        <div v-else class="bars" style="height:170px">
          <div v-for="s in slots" :key="s.time" class="bar-col">
            <div class="bar" :style="{ height: slotH(s) }" :title="s.time + '：' + s.count + ' 单'"></div>
            <div class="bar-label">{{ s.time }}</div>
          </div>
        </div>
      </div>
    </div>
  </template>
</div>
`
  }
});
