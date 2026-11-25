/* 服务项目管理 */
window.Views = Object.assign(window.Views || {}, {
  services: {
    data() {
      return {
        util: window.AdminUtil,
        list: [],
        loading: false,
        showForm: false,
        form: { id: 0, name: '', description: '', durationMinutes: 30, price: '', sort: 100 },
        saving: false
      };
    },
    mounted() {
      this.load();
    },
    computed: {
      slotMinutes() {
        const s = window.AdminState.store;
        return s && s.slotMinutes ? s.slotMinutes : 30;
      }
    },
    methods: {
      async load() {
        this.loading = true;
        try {
          this.list = await window.AdminAPI.services();
        } catch (e) {
          /* toast */
        } finally {
          this.loading = false;
        }
      },
      openNew() {
        this.form = { id: 0, name: '', description: '', durationMinutes: 30, price: '', sort: 100 };
        this.showForm = true;
      },
      openEdit(row) {
        this.form = {
          id: row.id,
          name: row.name,
          description: row.description || '',
          durationMinutes: row.durationMinutes,
          price: row.price === null ? '' : row.price,
          sort: row.sort
        };
        this.showForm = true;
      },
      async save() {
        const f = this.form;
        if (!f.name.trim()) return window.AdminToast('请填写项目名称', 'err');
        if (!f.durationMinutes || f.durationMinutes < 10) return window.AdminToast('服务时长至少 10 分钟', 'err');

        this.saving = true;
        const body = {
          name: f.name.trim(),
          description: f.description,
          durationMinutes: Number(f.durationMinutes),
          price: f.price === '' ? null : Number(f.price),
          sort: Number(f.sort) || 100
        };
        try {
          if (f.id) await window.AdminAPI.updateService(f.id, body);
          else await window.AdminAPI.createService(body);
          window.AdminToast(f.id ? '已保存' : '已新增');
          this.showForm = false;
          this.load();
        } catch (e) {
          /* toast */
        } finally {
          this.saving = false;
        }
      },
      async toggle(row, field) {
        try {
          await window.AdminAPI.toggleService(row.id, field, field === 'status' ? row.status !== 1 : row.bookable !== 1);
          this.load();
        } catch (e) {
          /* toast */
        }
      },
      async remove(row) {
        if (!confirm('确认下架「' + row.name + '」？\n有进行中预约的项目无法删除，会提示改为下架。')) return;
        try {
          await window.AdminAPI.deleteService(row.id);
          window.AdminToast('已下架');
          this.load();
        } catch (e) {
          /* toast */
        }
      },
      slotCountOf(duration) {
        return Math.max(1, Math.ceil(duration / this.slotMinutes));
      }
    },
    template: `
<div>
  <div class="card">
    <div class="row-between">
      <div>
        <div class="card-title">服务项目</div>
        <div class="card-sub">
          时长会按门店时段粒度（{{ slotMinutes }} 分钟）自动折算占用时段数；下架后不影响已有预约
        </div>
      </div>
      <button class="btn" @click="openNew">＋ 新增项目</button>
    </div>
  </div>

  <div class="card">
    <div v-if="loading" class="loading"><i class="spinner"></i>加载中…</div>
    <div v-else-if="!list.length" class="empty">还没有服务项目，先新增一个吧</div>
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th style="width:120px">名称</th>
            <th>说明</th>
            <th style="width:80px">时长</th>
            <th style="width:80px">占时段</th>
            <th style="width:80px">参考价</th>
            <th style="width:90px">可预约</th>
            <th style="width:80px">上架</th>
            <th style="width:150px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in list" :key="s.id">
            <td class="td-strong">{{ s.name }}</td>
            <td class="small muted">{{ s.description || '—' }}</td>
            <td class="mono">{{ s.durationMinutes }} 分</td>
            <td class="mono">{{ s.slotCount }}</td>
            <td class="mono">{{ s.price === null ? '—' : '¥' + s.price }}</td>
            <td>
              <button class="switch" :class="{ on: s.bookable }" @click="toggle(s, 'bookable')"></button>
            </td>
            <td>
              <button class="switch" :class="{ on: s.status === 1 }" @click="toggle(s, 'status')"></button>
            </td>
            <td>
              <div class="td-actions">
                <button class="btn btn-xs btn-ghost" @click="openEdit(s)">编辑</button>
                <button class="btn btn-xs btn-ghost" @click="remove(s)">下架</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div v-if="showForm" class="modal-mask" @click.self="showForm = false">
    <div class="modal">
      <div class="modal-head">
        <div class="modal-title">{{ form.id ? '编辑服务项目' : '新增服务项目' }}</div>
        <button class="modal-close" @click="showForm = false">×</button>
      </div>
      <div class="modal-body">
        <div class="col">
          <div class="field">
            <label class="field-label">项目名称 <span class="req">*</span></label>
            <input class="input" v-model="form.name" placeholder="如 头皮护理" maxlength="20" />
          </div>
          <div class="field">
            <label class="field-label">说明</label>
            <textarea class="textarea" rows="2" v-model="form.description" placeholder="给客人看的简短说明"></textarea>
          </div>
          <div class="form-grid">
            <div class="field">
              <label class="field-label">服务时长（分钟）<span class="req">*</span></label>
              <input class="input" type="number" v-model="form.durationMinutes" min="10" max="480" />
              <div class="small muted">将占用 {{ slotCountOf(Number(form.durationMinutes) || 0) }} 个时段</div>
            </div>
            <div class="field">
              <label class="field-label">参考价（元）</label>
              <input class="input" type="number" v-model="form.price" placeholder="可不填" />
            </div>
          </div>
          <div class="field">
            <label class="field-label">排序值（越小越靠前）</label>
            <input class="input" type="number" v-model="form.sort" />
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" @click="showForm = false">取消</button>
        <button class="btn" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
      </div>
    </div>
  </div>
</div>
`
  }
});
