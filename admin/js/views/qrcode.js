/* 预约二维码：生成 / 下载 / 扫码统计 */
window.Views = Object.assign(window.Views || {}, {
  qrcode: {
    data() {
      return {
        util: window.AdminUtil,
        list: [],
        loading: false,
        showCreate: false,
        form: { name: '', type: 1 },
        creating: false,
        stats: null,
        statsLoading: false,
        canEdit: false
      };
    },
    mounted() {
      const role = (window.AdminState.user && window.AdminState.user.role) || 3;
      this.canEdit = role <= 2;
      this.load();
    },
    methods: {
      async load() {
        this.loading = true;
        try {
          this.list = await window.AdminAPI.qrcodes();
        } catch (e) {
          /* toast */
        } finally {
          this.loading = false;
        }
      },
      openCreate() {
        this.form = { name: '', type: 1 };
        this.showCreate = true;
      },
      async create() {
        if (!this.form.name.trim()) return window.AdminToast('请填写二维码名称', 'err');
        this.creating = true;
        try {
          const res = await window.AdminAPI.createQrcode({
            name: this.form.name.trim(),
            type: Number(this.form.type)
          });
          window.AdminToast('已生成，场景值 ' + res.scene);
          this.showCreate = false;
          this.load();
        } catch (e) {
          /* toast */
        } finally {
          this.creating = false;
        }
      },
      async toggle(row) {
        try {
          await window.AdminAPI.toggleQrcode(row.id, row.status === 1 ? 0 : 1);
          this.load();
        } catch (e) {
          /* toast */
        }
      },
      async remove(row) {
        if (!confirm('删除「' + row.name + '」？扫码记录会一并清除，无法恢复。')) return;
        try {
          await window.AdminAPI.deleteQrcode(row.id);
          window.AdminToast('已删除');
          this.load();
        } catch (e) {
          /* toast */
        }
      },
      async viewStats(row) {
        this.statsLoading = true;
        this.stats = { name: row.name, trend: [] };
        try {
          this.stats = await window.AdminAPI.qrcodeStats(row.id);
        } catch (e) {
          this.stats = null;
        } finally {
          this.statsLoading = false;
        }
      },
      maxOf(trend) {
        return Math.max.apply(
          null,
          (trend || []).map((t) => t.scans).concat([1])
        );
      },
      barH(t) {
        return Math.max(3, Math.round((t.scans / this.maxOf(this.stats.trend)) * 120)) + 'px';
      }
    },
    template: `
<div>
  <div class="card">
    <div class="row-between">
      <div>
        <div class="card-title">门店预约二维码</div>
        <div class="card-sub">
          放在前台台卡、海报、朋友圈；客人扫码直达小程序预约页，扫码与转化自动统计
        </div>
      </div>
      <button v-if="canEdit" class="btn" @click="openCreate">＋ 生成二维码</button>
    </div>
  </div>

  <div v-if="loading" class="card"><div class="loading"><i class="spinner"></i>加载中…</div></div>
  <div v-else-if="!list.length" class="card"><div class="empty">还没有生成二维码</div></div>

  <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(272px,1fr));gap:16px;margin-top:16px">
    <div class="card" v-for="q in list" :key="q.id" style="margin:0">
      <div class="row" style="gap:14px;align-items:flex-start">
        <img :src="q.imageUrl" style="width:104px;height:104px;border-radius:8px;border:1px solid #EDE6DB;background:#fff" />
        <div class="grow">
          <div class="row-between">
            <div class="td-strong">{{ q.name }}</div>
            <span class="tag" :class="q.status === 1 ? 'tag-green' : 'tag-gray'">{{ q.status === 1 ? '启用' : '停用' }}</span>
          </div>
          <div class="small muted" style="margin-top:4px">{{ q.typeText }} · {{ q.scene }}</div>
          <div class="small" style="margin-top:8px">
            扫码 <b class="mono">{{ q.scanCount }}</b> 次 · 预约 <b class="mono">{{ q.bookCount }}</b> 单
          </div>
          <div class="small muted">转化率 {{ q.convertRate }}%</div>
        </div>
      </div>

      <div class="row" style="margin-top:14px;gap:8px;flex-wrap:wrap">
        <a :href="q.imageUrl" :download="q.name + '.png'" class="btn btn-ghost btn-xs">下载</a>
        <button class="btn btn-ghost btn-xs" @click="viewStats(q)">扫码趋势</button>
        <button v-if="canEdit" class="btn btn-ghost btn-xs" @click="toggle(q)">{{ q.status === 1 ? '停用' : '启用' }}</button>
        <button v-if="canEdit" class="btn btn-ghost btn-xs" @click="remove(q)">删除</button>
      </div>
    </div>
  </div>

  <div class="card" style="margin-top:16px">
    <div class="card-title" style="margin-bottom:10px">使用说明</div>
    <div class="small" style="line-height:2;color:#5A5148">
      <div>1. 未配置微信 AppID 时生成的是<strong>开发态占位码</strong>，扫码不会跳转小程序，仅用于确认版式。</div>
      <div>2. 在 <code>.env</code> 配置 <code>WX_APPID</code> / <code>WX_SECRET</code> 后，重新生成即为正式小程序码（扫码直达）。</div>
      <div>3. 场景值（scene）会带入小程序，用于区分「台卡 / 海报 / 朋友圈」的来源效果。</div>
      <div>4. 同一客人同一天扫同一个码只计 1 次，避免刷量。</div>
    </div>
  </div>

  <div v-if="showCreate" class="modal-mask" @click.self="showCreate = false">
    <div class="modal">
      <div class="modal-head">
        <div class="modal-title">生成预约二维码</div>
        <button class="modal-close" @click="showCreate = false">×</button>
      </div>
      <div class="modal-body">
        <div class="col">
          <div class="field">
            <label class="field-label">名称 <span class="req">*</span></label>
            <input class="input" v-model="form.name" placeholder="如 前台台卡 / 朋友圈海报 / 电梯广告" maxlength="30" />
          </div>
          <div class="field">
            <label class="field-label">类型</label>
            <select class="select" v-model="form.type">
              <option :value="1">小程序码（推荐）</option>
              <option :value="2">公众号带参码</option>
            </select>
          </div>
          <div class="small muted">场景值会自动生成并保持唯一，用于统计不同渠道效果。</div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" @click="showCreate = false">取消</button>
        <button class="btn" :disabled="creating" @click="create">{{ creating ? '生成中…' : '生成' }}</button>
      </div>
    </div>
  </div>

  <div v-if="stats" class="modal-mask" @click.self="stats = null">
    <div class="modal modal-lg">
      <div class="modal-head">
        <div class="modal-title">{{ stats.name }} · 近 14 天扫码趋势</div>
        <button class="modal-close" @click="stats = null">×</button>
      </div>
      <div class="modal-body">
        <div v-if="statsLoading" class="loading"><i class="spinner"></i>加载中…</div>
        <template v-else>
          <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px">
            <div class="stat"><div class="stat-label">累计扫码</div><div class="stat-value">{{ stats.scanCount }}</div></div>
            <div class="stat"><div class="stat-label">带来预约</div><div class="stat-value">{{ stats.bookCount }}</div></div>
            <div class="stat"><div class="stat-label">转化率</div><div class="stat-value">{{ stats.convertRate }}%</div></div>
          </div>
          <div v-if="!stats.trend.length" class="empty">该时间段没有扫码记录</div>
          <div v-else class="bars">
            <div v-for="t in stats.trend" :key="t.date" class="bar-col">
              <div class="bar" :class="{ dim: !t.scans }" :style="{ height: barH(t) }" :title="t.scans + ' 次扫码 / ' + t.converted + ' 单预约'"></div>
              <div class="bar-label">{{ t.date.slice(5) }}</div>
            </div>
          </div>
        </template>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" @click="stats = null">关闭</button>
      </div>
    </div>
  </div>
</div>
`
  }
});
