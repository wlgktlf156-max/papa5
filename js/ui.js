/**
 * 화면(HTML) 쪽 UI: 로딩 · 입장 화면 · 조작 안내 · 작품 근접 안내 · 확대 전 정보 카드 · 폴백
 */

export class UI {
  constructor(cfg) {
    this.cfg = cfg;
    this.$ = (id) => document.getElementById(id);

    this.loading = this.$('loading');
    this.bar = this.$('load-bar');
    this.pct = this.$('load-pct');
    this.stage = this.$('load-stage');
    this.entry = this.$('entry');
    this.hud = this.$('hud');
    this.pill = this.$('pill');
    this.pillTitle = this.$('pill-title');
    this.pillArtist = this.$('pill-artist');
    this.pillKey = this.$('pill-key');
    this.btnView = this.$('btn-view');
    this.card = this.$('card');
    this.firstHint = this.$('first-hint');
    this.fallback = this.$('fallback');
    this.debug = this.$('debug');
    this.toastEl = this.$('toast');
    this.joy = this.$('joy');

    this.fill();
    this._bind();
  }

  fill() {
    const ex = this.cfg.exhibition;
    const names = this.cfg.artists.map((a) => a.name).join(' · ');
    const set = (id, text) => {
      const el = this.$(id);
      if (el) el.textContent = text;
    };
    set('hud-title', ex.title);
    set('load-title', ex.title);
    set('entry-kicker', ex.kicker);
    set('entry-t1', ex.titleLine1);
    set('entry-t2', ex.titleLine2);
    set('entry-period', ex.period);
    set('entry-place', ex.place);
    set('entry-artists', names);
    set('entry-note', ex.demoNote);
    set('btn-enter', ex.entryButton);
    set('fb-title', ex.title);
    set('fb-artists', names);
    set('first-hint-text', '마우스로 둘러보고, W A S D 로 걸어 보세요. 작품 가까이 가면 액자가 빛납니다.');
    document.title = ex.title;
  }

  /** works.json 을 읽은 뒤 작품 수를 알려 줍니다. */
  setWorkCount(count) {
    this.workCount = count;
    const el = this.$('fb-count');
    if (el) el.textContent = `작품 ${count}점 · 작가 ${this.cfg.artists.length}명`;
  }

  /** works.json 을 읽지 못했을 때 안내 문구를 남깁니다. */
  setDataError(message) {
    this.dataError = message;
    const note = this.$('entry-note');
    if (note) note.textContent = '작품 목록을 읽지 못했습니다. ' + message;
  }

  _bind() {
    const help = this.$('btn-help');
    if (help) help.addEventListener('click', () => this.showEntry(true));
    const closeHint = this.$('first-hint-close');
    if (closeHint) closeHint.addEventListener('click', () => this.hideFirstHint());
    const cardClose = this.$('card-close');
    if (cardClose) cardClose.addEventListener('click', () => this.hideCard());
    if (this.card) {
      this.card.addEventListener('click', (e) => {
        if (e.target === this.card) this.hideCard();
      });
    }
  }

  onEnter(cb) {
    const b = this.$('btn-enter');
    if (b) b.addEventListener('click', cb);
  }

  onView(cb) {
    if (this.btnView) this.btnView.addEventListener('click', cb);
    if (this.pill) this.pill.addEventListener('click', cb);
  }

  onHelpClose(cb) {
    const b = this.$('btn-help-close');
    if (b) b.addEventListener('click', cb);
  }

  /* ── 로딩 ─────────────────────────────────────────────── */
  setProgress(v, label) {
    const p = Math.max(0, Math.min(1, v));
    if (this.bar) this.bar.style.width = (p * 100).toFixed(1) + '%';
    if (this.pct) this.pct.textContent = Math.round(p * 100) + '%';
    if (label && this.stage) this.stage.textContent = label;
  }

  loadingDone() {
    if (!this.loading) return;
    this.loading.classList.add('done');
    setTimeout(() => {
      this.loading.hidden = true;
    }, 520);
  }

  /* ── 입장 화면 ────────────────────────────────────────── */
  showEntry(helpMode = false) {
    if (!this.entry) return;
    this.entry.hidden = false;
    this.entry.classList.add('show');
    const controlsBlock = this.$('entry-controls');
    if (controlsBlock) controlsBlock.hidden = false;
    const enterBtn = this.$('btn-enter');
    if (enterBtn) enterBtn.textContent = helpMode ? '계속 관람하기' : this.cfg.exhibition.entryButton;
    this._helpMode = helpMode;
  }

  hideEntry() {
    if (!this.entry) return;
    this.entry.classList.remove('show');
    this.entry.hidden = true;
  }

  showFirstHint() {
    if (!this.firstHint) return;
    this.firstHint.hidden = false;
    this.firstHint.classList.add('show');
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => this.hideFirstHint(), 9000);
  }

  hideFirstHint() {
    if (!this.firstHint) return;
    this.firstHint.classList.remove('show');
    this.firstHint.hidden = true;
  }

  /* ── 근접 안내 ────────────────────────────────────────── */
  showPill(work, artist, x, y) {
    if (!this.pill) return;
    this.pillTitle.textContent = work.title;
    this.pillArtist.textContent = artist.name;
    if (this.pillKey) this.pillKey.textContent = this.isTouch ? '탭' : 'E';
    this.pill.hidden = false;
    this.pill.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
    if (this.btnView) this.btnView.hidden = !this.isTouch;
  }

  hidePill() {
    if (this.pill) this.pill.hidden = true;
    if (this.btnView) this.btnView.hidden = true;
  }

  /* ── 작품 정보 카드 ───────────────────────────────────── */
  showCard(work, artist) {
    if (!this.card) return;
    this.$('card-artist').textContent = artist.name;
    this.$('card-title').textContent = work.title;
    this.$('card-year').textContent = work.year || '';
    this.$('card-size').textContent = `${Math.round(work.width * 100)} × ${Math.round(
      work.height * 100
    )} cm`;
    this.$('card-media').textContent = work.medium || '재료 미정';
    this.card.hidden = false;
    this.card.classList.add('show');
    this.hidePill();
  }

  hideCard() {
    if (!this.card) return;
    this.card.classList.remove('show');
    this.card.hidden = true;
  }

  isCardOpen() {
    return this.card && !this.card.hidden;
  }

  /* ── 기타 ─────────────────────────────────────────────── */
  setTouch(v) {
    this.isTouch = !!v;
    document.body.classList.toggle('is-touch', !!v);
    if (this.pillKey) this.pillKey.textContent = v ? '탭' : 'E';
  }

  toast(msg) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 2600);
  }

  setDebug(text) {
    if (!this.debug) return;
    this.debug.textContent = text;
  }

  showFallback(reason) {
    if (this.loading) this.loading.hidden = true;
    if (this.entry) this.entry.hidden = true;
    if (this.hud) this.hud.hidden = true;
    if (this.fallback) {
      this.fallback.hidden = false;
      const r = this.$('fb-reason');
      if (r) r.textContent = reason || '';
    }
  }
}
