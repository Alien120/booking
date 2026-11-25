/* 客户管理：列表 + 详情抽屉 + 编辑 + 查看完整手机号 */
window.Views = Object.assign(window.Views || {}, {
  customers: {
    data() {
      return {
        util: window.AdminUtil,
        keyword: '',
        sort: 'recent',
        list: [],
        total: 0,
        page: 1,
        size: 20,
        loading: false,

        detail: null,
        detailLoading: false,
        editing: false,
        editForm: { name: '', tagsText: '', carePreference: '', allergyNote: '', staffNote: '' },
        saving: false,
        revealedPhone: '',
        canReveal: false
      };
    },
    computed: {
      totalPages() {
        return Math.max(1, Math.ceil(this.total / this.size));
      }
    },
    mounted() {
      const role = (window.AdminState.user && window.AdminState.user.role) || 3;
      this.canReveal = role <= 2;
      this.load();
    },
    methods: {
      async load() {
        this.loading = true;
        try {
          const res = await window.AdminAPI.customers({
            keyword: this.keyword.trim(),
            sort: this.sort,
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
      pageTo(p) {
        if (p < 1 || p > this.totalPages) return;
        this.page = p;
        this.load();
      },
      exportCsv() {
        window.AdminAPI.exportCustomers({ keyword: this.keyword.trim() });
      },

      async openDetail(id) {
        this.detailLoading = true;
        this.editing = false;
        this.revealedPhone = '';
        this.detail = { id: id };
        try {
          const d = await window.AdminAPI.customer(id);
          this.detail = d;
          this.editForm = {
            name: d.name || '',
            tagsText: (d.tags || []).join(','),
            carePreference: d.carePreference || '',
            allergyNote: d.allergyNote || '',
            staffNote: d.staffNote || ''
          };
        } catch (e) {
          this.detail = null;
        } finally {
          this.detailLoading = false;
        }
      },
      closeDetail() {
        this.detail = null;
      },
      async saveEdit() {
        this.saving = true;
        try {
          const tags = this.editForm.tagsText
            .split(/[,，\s]+/)
            .map((t) => t.trim())
            .filter(Boolean);
          this.detail = await window.AdminAPI.updateCustomer(this.detail.id, {
            name: this.editForm.name,
            tags: tags,
            carePreference: this.editForm.carePreference,
            allergyNote: this.editForm.allergyNote,
            staffNote: this.editForm.staffNote
          });
          this.editing = false;
          window.AdminToast('已保存');
          this.load();
        } catch (e) {
          /* toast */
        } finally {
          this.saving = false;
        }
      },
      async reveal() {
        if (
          !confirm(
            '查看完整手机号属于敏感操作，会记录操作人。\n仅用于门店联系客人，请勿外传。确认查看？'
          )
        )
          return;
        try {
          const res = await window.AdminAPI.revealPhone(this.detail.id);
          this.revealedPhone = res.phone;
          window.AdminToast('本次查看已记入审计日志');
        } catch (e) {
          /* toast */
        }
      }
    },
    template: `
<div>
  <div class="card">
    <div class="row" style="gap:12px;align-items:flex-end">
      <div class="field" style="width:240px">
        <label class="field-label">姓名 / 手机尾号</label>
        <input class="input" v-model="keyword" placeholder="如 李 或 8001" @keyup.enter="search" />
      </div>
      <div class="field" style="width:160px">
        <label class="field-label">排序</label>
        <select class="select" v-model="sort" @change="search">
          <option value="recent">最近到店优先</option>
          <option value="count">预约次数优先</option>
          <option value="new">最近新增优先</option>
        </select>
      </div>
      <button class="btn" @click="search">查询</button>
      <button class="btn btn-ghost" @click="exportCsv">导出 CSV</button>
      <div class="spacer"></div>
      <span class="muted small">共 {{ total }} 位客户</span>
    </div>
  </div>

  <div class="card">
    <div v-if="loading" class="loading"><i class="spinner"></i>加载中…</div>
    <div v-else-if="!list.length" class="empty">没有匹配的客户</div>
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th style="width:150px">客户</th>
            <th style="width:130px">手机号</th>
            <th>标签 / 偏好</th>
            <th style="width:80px">预约</th>
            <th style="width:80px">取消</th>
            <th style="width:80px">未到店</th>
            <th style="width:140px">最近到店</th>
            <th style="width:90px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in list" :key="c.id">
            <td class="td-strong">{{ c.name }}</td>
            <td class="mono small muted">{{ c.phoneMasked || '—' }}</td>
            <td>
              <span v-for="t in c.tags" :key="t" class="tag tag-blue" style="margin-right:4px">{{ t }}</span>
              <span class="small muted">{{ c.carePreference || '' }}</span>
            </td>
            <td class="mono">{{ c.apptCount }}</td>
            <td class="mono" :style="c.cancelCount ? 'color:#A9762A' : ''">{{ c.cancelCount }}</td>
            <td class="mono" :style="c.noshowCount ? 'color:#9B5656' : ''">{{ c.noshowCount }}</td>
            <td class="small muted">{{ c.lastVisitAt || '—' }}</td>
            <td><button class="btn btn-xs btn-ghost" @click="openDetail(c.id)">详情</button></td>
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

  <template v-if="detail">
    <div class="drawer-mask" @click="closeDetail"></div>
    <div class="drawer">
      <div class="drawer-head">
        <div>
          <div class="modal-title">{{ detail.name || '未填写姓名' }}</div>
          <div class="small muted" style="margin-top:3px">
            {{ revealedPhone || detail.phoneMasked || '未留存手机号' }}
          </div>
        </div>
        <button class="modal-close" @click="closeDetail">×</button>
      </div>

      <div class="drawer-body">
        <div v-if="detailLoading" class="loading"><i class="spinner"></i>加载中…</div>
        <template v-else>
          <div class="row" style="gap:8px;margin-bottom:16px">
            <button v-if="canReveal && !revealedPhone" class="btn btn-ghost btn-sm" @click="reveal">查看完整手机号</button>
            <button class="btn btn-ghost btn-sm" @click="editing = !editing">{{ editing ? '取消编辑' : '编辑资料' }}</button>
          </div>

          <div v-if="editing" class="col">
            <div class="field">
              <label class="field-label">姓名</label>
              <input class="input" v-model="editForm.name" />
            </div>
            <div class="field">
              <label class="field-label">标签（逗号分隔）</label>
              <input class="input" v-model="editForm.tagsText" placeholder="如：敏感头皮,高客单" />
            </div>
            <div class="field">
              <label class="field-label">护理偏好</label>
              <input class="input" v-model="editForm.carePreference" placeholder="如：偏好无硅油产品" />
            </div>
            <div class="field">
              <label class="field-label">过敏备注</label>
              <input class="input" v-model="editForm.allergyNote" placeholder="如：对含硫洗发水过敏" />
            </div>
            <div class="field">
              <label class="field-label">内部备注（客人不可见）</label>
              <textarea class="textarea" rows="3" v-model="editForm.staffNote"></textarea>
            </div>
            <button class="btn" :disabled="saving" @click="saveEdit">{{ saving ? '保存中…' : '保存' }}</button>
          </div>

          <template v-else>
            <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
              <div class="stat" style="padding:12px"><div class="stat-label">预约</div><div class="stat-value" style="font-size:20px">{{ detail.apptCount }}</div></div>
              <div class="stat" style="padding:12px"><div class="stat-label">到店</div><div class="stat-value" style="font-size:20px">{{ detail.arriveCount }}</div></div>
              <div class="stat" style="padding:12px"><div class="stat-label">取消</div><div class="stat-value" style="font-size:20px">{{ detail.cancelCount }}</div></div>
              <div class="stat" style="padding:12px"><div class="stat-label">未到</div><div class="stat-value" style="font-size:20px">{{ detail.noshowCount }}</div></div>
            </div>

            <table class="table" style="margin-bottom:16px">
              <tbody>
                <tr><td class="muted" style="width:96px">标签</td>
                    <td><span v-for="t in detail.tags" :key="t" class="tag tag-blue" style="margin-right:4px">{{ t }}</span>
                        <span v-if="!detail.tags.length" class="muted">—</span></td></tr>
                <tr><td class="muted">护理偏好</td><td>{{ detail.carePreference || '—' }}</td></tr>
                <tr><td class="muted">过敏备注</td><td :style="detail.allergyNote ? 'color:#9B5656;font-weight:500' : ''">{{ detail.allergyNote || '—' }}</td></tr>
                <tr><td class="muted">内部备注</td><td>{{ detail.staffNote || '—' }}</td></tr>
                <tr><td class="muted">最近到店</td><td>{{ detail.lastVisitAt || '—' }}</td></tr>
                <tr><td class="muted">建档时间</td><td>{{ detail.createdAt }}</td></tr>
              </tbody>
            </table>

            <div class="card-title" style="margin-bottom:10px">预约历史</div>
            <table class="table">
              <thead><tr><th>日期</th><th>时间</th><th>项目</th><th>状态</th></tr></thead>
              <tbody>
                <tr v-for="a in detail.appointments" :key="a.id">
                  <td class="mono small">{{ a.date }}</td>
                  <td class="mono small">{{ a.startTime }}</td>
                  <td class="small">{{ a.serviceName }}</td>
                  <td><span class="tag" :class="util.statusTag(a.status)">{{ a.statusText }}</span></td>
                </tr>
                <tr v-if="!detail.appointments.length"><td colspan="4" class="muted small">暂无预约记录</td></tr>
              </tbody>
            </table>
          </template>
        </template>
      </div>

      <div class="drawer-foot">
        <button class="btn btn-ghost" @click="closeDetail">关闭</button>
      </div>
    </div>
  </template>
</div>
`
  }
});
