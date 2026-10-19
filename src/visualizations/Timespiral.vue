<template lang="pug">
div.timespiral
  div.ts-stage(ref="stage")
    canvas(
      ref="canvas"
      tabindex="0"
      @wheel.prevent="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="endDrag"
      @pointercancel="endDrag"
      @pointerleave="onPointerLeave"
      @dblclick="onDblClick"
      @keydown="onKeyDown"
    )
    //- Styled as a popover so it follows the light/dark theme.
    div.popover.ts-tip(v-if="tip" :style="{ transform: `translate(${tip.x}px, ${tip.y}px)` }")
      div.popover-body
        template(v-if="tip.cat")
          div.ts-tip-cat
            span.ts-dot(:style="{ background: tip.color }")
            | {{ tip.cat }}
          div {{ tip.span }}
          div.ts-tip-title(v-if="tip.app")
            b {{ tip.app }}
            span(v-if="tip.title") &nbsp;— {{ tip.title }}
        div(v-else) {{ tip.empty }}
        div.text-muted {{ tip.when }}
    div.ts-loading.small.text-muted(v-if="loading") {{ $t('common.loading') }}

  div.ts-side
    div.ts-focus
      div.ts-focus-date {{ focusDate }}
      div.ts-focus-time {{ focusTime }}
    div.ts-controls
      b-button-group(size="sm")
        b-button(variant="outline-dark" :title="$t('timespiral.prevDay')" @click="stepDays(-1)") &lsaquo;
        b-button(variant="outline-dark" :pressed="following" @click="goNow") {{ $t('timespiral.now') }}
        b-button(variant="outline-dark" :title="$t('timespiral.nextDay')" @click="stepDays(1)") &rsaquo;
      b-form-checkbox.ml-3(v-model="screw" switch size="sm") {{ $t('timespiral.rotate') }}
    div.ts-depth
      label.small.mb-0(for="ts-depth") {{ $t('timespiral.depth') }}
      b-form-input#ts-depth(v-model.number="q" type="range" min="1.06" max="1.45" step="0.01" size="sm")

    div.ts-legend
      div.ts-legend-head
        span {{ legendTitle }}
        span.ts-dur {{ legendTotal }}
      div.ts-legend-row(
        v-for="row in legend"
        :key="row.top"
        :class="{ on: isolate === row.top, off: (isolate || hoverTop) && (isolate || hoverTop) !== row.top }"
        @click="toggleIsolate(row.top)"
        @mouseenter="setHoverTop(row.top)"
        @mouseleave="setHoverTop(null)"
      )
        span.ts-dot(:style="{ background: row.color }")
        span.ts-name {{ row.top }}
        span.ts-dur {{ row.dur }}
        span.ts-bar(:style="{ background: row.color, width: row.pct + '%' }")
      div.small.text-muted(v-if="!legend.length") {{ legendEmpty }}

    p.small.text-muted.mt-3.mb-1 {{ $t('timespiral.help') }}
    p.small.text-muted {{ $t('timespiral.keys') }}
</template>

<script lang="ts">
// The timespiral: activity as a logarithmic spiral with one turn per day.
//
// Scrolling moves through time, which zooms the spiral (and, with "rotate with
// time", turns it so the focused time stays at the top). Stepping a whole day
// is a pure zoom by a factor q. Days are fetched lazily as they come into view.
//
// Rendering: each loaded day is turned into one Path2D per category, in that
// day's own coordinates (see geometry.ts). Since moving through time only
// zooms and rotates the spiral, every frame just redraws those paths with a
// different transform.

import { useBucketsStore } from '~/stores/buckets';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';
import { getClient } from '~/util/awclient';
import { get_hour_offset } from '~/util/time';
import { earliestEventInBuckets } from '~/util/earliestEvent';
import { canonicalEvents, querystr_to_array } from '~/queries';
import { DayLoader, Day, Run, findAt, SEP } from './timespiral/days';
import { ms2L, L2ms, nowL, fmtDur, activityDay } from './timespiral/time';
import {
  View,
  TAU,
  BAND,
  radius,
  angle,
  point,
  hitTest,
  visibleRange,
  dayTransform,
  dayBand,
  screenBand,
} from './timespiral/geometry';

const MINUTE = 1 / 1440;

interface DayPaths {
  loadedAt: number;
  q: number;
  colorVersion: number;
  paths: { top: string; color: string; path: Path2D }[];
}

function toPath(pts: number[], path = new Path2D()): Path2D {
  path.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) path.lineTo(pts[i], pts[i + 1]);
  path.closePath();
  return path;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default {
  name: 'Timespiral',
  props: {
    host: { type: String, required: true },
  },
  data() {
    return {
      q: 1.2,
      screw: true,
      following: true,
      isolate: null as string | null,
      hoverTop: null as string | null,
      loading: false,
      focusDate: '',
      focusTime: '',
      legendTitle: '',
      legendTotal: '',
      legendEmpty: '',
      legend: [] as { top: string; color: string; dur: string; pct: number }[],
      tip: null as null | Record<string, any>,
    };
  },
  computed: {
    offset(): number {
      return get_hour_offset(useSettingsStore().startOfDay) / 24;
    },
    query(): string[] | null {
      const buckets = useBucketsStore();
      const categories = useCategoryStore().classes_for_query;
      const win = buckets.bucketsWindow(this.host)[0];
      if (win) {
        const afk = buckets.bucketsAFK(this.host)[0] || '';
        const q = canonicalEvents({
          bid_window: win,
          bid_afk: afk,
          filter_afk: !!afk,
          bid_browsers: buckets.bucketsBrowser(this.host),
          include_audible: true,
          always_active_pattern: useSettingsStore().always_active_pattern || undefined,
          categories,
          filter_categories: [],
        });
        return querystr_to_array(q + '\nRETURN = events;');
      }
      const android = buckets.bucketsAndroid(this.host);
      if (android.length) {
        const ios = android.find((id: string) => id.startsWith('aw-import-screentime'));
        const q = canonicalEvents({
          bid_android: ios || android[0],
          isIos: !!ios,
          keep_event_timestamps: true,
          categories,
          filter_categories: [],
        });
        return querystr_to_array(q + '\nRETURN = events;');
      }
      return null;
    },
  },
  watch: {
    query(next, prev) {
      if (JSON.stringify(next) === JSON.stringify(prev)) return;
      this.colors = new Map();
      this.colorVersion++;
      this.reload();
    },
    offset() {
      this.reload();
    },
    q() {
      this.layout();
      this.invalidate();
    },
    screw() {
      this.invalidate();
    },
    isolate() {
      this.invalidate();
    },
    hoverTop() {
      this.invalidate();
    },
  },
  created() {
    // Per-frame state lives outside data() so Vue doesn't track it.
    const now = nowL();
    this.s = {
      F: now, // focused time, as drawn
      Ft: now, // focused time, target
      follow: true, // stick to now
      vel: 0, // fling velocity, days per second
      tween: null as null | { from: number; to: number; t0: number; dur: number; follow: boolean },
      m: 1, // animated rotation blend: 0 = fixed clock, 1 = rotate with time
      dragging: false,
      dragPhi: 0,
      dragT: 0,
      wheelAcc: 0,
      hover: null as null | { x: number; y: number },
      hit: null as null | { run: Run; L: number },
    };
    this.W = 0;
    this.H = 0;
    this.DPR = 1;
    this.view = { cx: 0, cy: 0, R: 100, q: this.q, F: now, rho: 0 } as View;
    this.first = -Infinity; // earliest activity day with data
    this.loader = null as DayLoader | null;
    this.dayPaths = new Map<number, DayPaths>();
    this.colors = new Map<string, string>();
    this.colorVersion = 0;
    this.raf = 0;
    this.lastFrame = 0;
    this.lastWant = 0;
    this.uiKey = '';
    this.reloadToken = 0;
  },
  mounted() {
    this.ctx = this.$refs.canvas.getContext('2d');
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.$refs.stage);
    this.timer = setInterval(() => {
      // Keep "now" moving and today's data fresh.
      this.lastWant = 0;
      this.invalidate();
    }, 15_000);
    this.resize();
    this.reload();
  },
  beforeDestroy() {
    cancelAnimationFrame(this.raf);
    clearInterval(this.timer);
    this.resizeObserver.disconnect();
    if (this.loader) this.loader.stop();
  },
  methods: {
    async reload() {
      if (this.loader) this.loader.stop();
      this.loader = null;
      this.dayPaths = new Map();
      this.invalidate();
      const token = ++this.reloadToken;
      const query = this.query;
      if (!query) return;
      const first = await this.findFirstDay();
      if (token !== this.reloadToken) return; // superseded by a later reload
      this.first = first;
      const client = getClient();
      this.loader = new DayLoader(
        periods =>
          client.query(
            periods.map(
              ([a, b]) => `${new Date(L2ms(a)).toISOString()}/${new Date(L2ms(b)).toISOString()}`
            ),
            query,
            { name: 'timespiral' }
          ),
        {
          offset: this.offset,
          first,
          onLoad: () => this.invalidate(),
          onError: err => console.warn('timespiral: failed to load days', err),
        }
      );
      this.lastWant = 0;
      this.invalidate();
    },

    async findFirstDay(): Promise<number> {
      const bucketsStore = useBucketsStore();
      const ids = [
        ...bucketsStore.bucketsWindow(this.host),
        ...bucketsStore.bucketsAndroid(this.host),
      ];
      const buckets = ids.map(id => bucketsStore.getBucket(id)).filter(b => b);
      try {
        const client = getClient();
        const earliest = await earliestEventInBuckets(buckets, (id, params) =>
          client.getEvents(id, params)
        );
        if (earliest) return activityDay(ms2L(earliest.getTime()), this.offset);
      } catch (e) {
        console.warn('timespiral: failed to find earliest event', e);
      }
      const created = buckets
        .map(b => b.first_seen || b.created)
        .filter(d => d)
        .map(d => new Date(d).getTime());
      return created.length ? activityDay(ms2L(Math.min(...created)), this.offset) - 1 : -Infinity;
    },

    // ---- layout & frame loop -------------------------------------------------
    resize() {
      const stage = this.$refs.stage;
      const canvas = this.$refs.canvas;
      this.DPR = Math.min(window.devicePixelRatio || 1, 2);
      this.W = stage.clientWidth;
      this.H = stage.clientHeight;
      canvas.width = Math.round(this.W * this.DPR);
      canvas.height = Math.round(this.H * this.DPR);
      canvas.style.width = `${this.W}px`;
      canvas.style.height = `${this.H}px`;
      this.layout();
      this.invalidate();
    },

    layout() {
      // The focused turn's band (and the clock labels outside it) should fit.
      const v = this.view;
      v.q = this.q;
      v.cx = this.W / 2;
      v.cy = this.H / 2;
      v.R = Math.max(40, (Math.min(this.W, this.H) / 2 - 36) / Math.pow(this.q, 0.5));
      this.dayPaths = new Map();
      this.trackPath = null;
    },

    invalidate() {
      if (!this.raf) this.raf = requestAnimationFrame(t => this.frame(t));
    },

    frame(t: number) {
      this.raf = 0;
      const dt = this.lastFrame ? Math.min(0.1, (t - this.lastFrame) / 1000) : 0;
      this.lastFrame = t;
      const moving = this.step(dt);
      this.requestData();
      this.draw();
      this.refreshHover();
      this.updateUi();
      if (moving) this.invalidate();
      else this.lastFrame = 0;
    },

    /** Advances motion; returns true while anything is still moving. */
    step(dt: number): boolean {
      const s = this.s;
      const now = nowL();
      let moving = false;
      if (s.tween) {
        const p = Math.min(1, (performance.now() - s.tween.t0) / s.tween.dur);
        s.Ft = s.F = s.tween.from + (s.tween.to - s.tween.from) * easeInOut(p);
        if (p >= 1) {
          s.follow = s.tween.follow;
          s.tween = null;
        }
        moving = true;
      } else if (!s.dragging) {
        if (s.vel) {
          s.Ft += s.vel * dt;
          s.vel *= Math.exp(-dt * 2.2);
          if (Math.abs(s.vel) < 0.002) s.vel = 0;
          moving = true;
        }
        if (s.Ft >= now) {
          // Scrolled into the future: snap to now and keep following it.
          if (s.Ft > now) s.follow = true;
          s.Ft = now;
          s.vel = Math.min(s.vel, 0);
        }
        if (s.follow) s.Ft = now;
        const lo = this.first + this.offset;
        if (s.Ft < lo) {
          s.Ft = lo;
          s.vel = 0;
        }
        const k = dt ? 1 - Math.exp(-dt * 11) : 0;
        s.F += (s.Ft - s.F) * k;
        if (Math.abs(s.Ft - s.F) < 1e-6 || s.follow) s.F = s.Ft;
        else moving = true;
      }
      const mt = this.screw ? 1 : 0;
      if (s.m !== mt) {
        s.m += (mt - s.m) * (dt ? 1 - Math.exp(-dt * 7) : 0);
        if (Math.abs(mt - s.m) < 1e-3) s.m = mt;
        moving = true;
      }
      this.view.F = s.F;
      this.view.rho = s.m * (s.F - Math.floor(s.F));
      if (this.following !== s.follow) this.following = s.follow;
      return moving;
    },

    flyTo(L: number, dur = 700, follow = false) {
      const s = this.s;
      const now = nowL();
      L = Math.min(Math.max(L, this.first + this.offset), now);
      s.vel = 0;
      s.follow = false;
      s.tween = { from: s.F, to: L, t0: performance.now(), dur, follow: follow || L >= now };
      this.invalidate();
    },

    /** Where a relative jump starts: the target of an ongoing one, else the focus. */
    base(): number {
      return this.s.tween ? this.s.tween.to : this.s.Ft;
    },

    stepDays(n: number) {
      this.flyTo(this.base() + n, 650);
    },

    goNow() {
      this.flyTo(nowL(), 900, true);
    },

    requestData() {
      const loader = this.loader;
      if (!loader) return;
      const t = performance.now();
      if (t - this.lastWant < 300) return;
      this.lastWant = t;
      const { lo, hi } = visibleRange(this.view, this.W, this.H);
      const F = this.s.F;
      const today = activityDay(nowL(), this.offset);
      const wanted: number[] = [];
      const top_ = Math.min(activityDay(hi, this.offset), today);
      for (let d = top_; d >= Math.max(activityDay(lo, this.offset), this.first); d--)
        wanted.push(d);
      // Closest to the focus first (that's where the turns are big).
      wanted.sort(
        (a, b) => Math.abs(a + 0.5 + this.offset - F) - Math.abs(b + 0.5 + this.offset - F)
      );
      loader.want(wanted);
    },

    // ---- drawing ---------------------------------------------------------------
    themeColors() {
      // Follow the page's text color, so the light and dark themes both work.
      const style = getComputedStyle(this.$refs.canvas);
      if (style.color !== this.themeKey) {
        this.themeKey = style.color;
        const m = style.color.match(/[\d.]+/g) || ['0', '0', '0'];
        const rgba = (a: number) => `rgba(${m[0]}, ${m[1]}, ${m[2]}, ${a})`;
        this.theme = {
          text: rgba(0.9),
          label: rgba(0.6),
          tick: rgba(0.35),
          track: rgba(0.07),
          font: style.fontFamily,
        };
      }
      return this.theme;
    },

    color(cat: string[]): string {
      const key = cat.join(SEP);
      let c = this.colors.get(key);
      if (!c) {
        c = useCategoryStore().get_category_color(cat);
        this.colors.set(key, c);
      }
      return c;
    },

    pathsFor(day: Day): DayPaths {
      let dp = this.dayPaths.get(day.d);
      if (
        dp &&
        dp.loadedAt === day.loadedAt &&
        dp.q === this.q &&
        dp.colorVersion === this.colorVersion
      )
        return dp;
      const byKey = new Map<string, { top: string; color: string; path: Path2D }>();
      for (const run of day.runs) {
        let entry = byKey.get(run.key);
        if (!entry) {
          entry = { top: run.top, color: this.color(run.cat), path: new Path2D() };
          byKey.set(run.key, entry);
        }
        toPath(dayBand(this.q, run.s - day.d, run.e - day.d, -BAND, BAND), entry.path);
      }
      dp = {
        loadedAt: day.loadedAt,
        q: this.q,
        colorVersion: this.colorVersion,
        paths: [...byKey.values()],
      };
      this.dayPaths.set(day.d, dp);
      return dp;
    },

    draw() {
      const ctx: CanvasRenderingContext2D = this.ctx;
      const v: View = this.view;
      const DPR = this.DPR;
      const theme = this.themeColors();
      const now = nowL();
      const firstL = this.first + this.offset;
      const visible = visibleRange(v, this.W, this.H);
      const lo = Math.max(visible.lo, firstL);
      // Looking back in time, show one (faded) turn of what came after the focus.
      const hi = Math.min(visible.hi, now, v.F + 1);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.$refs.canvas.width, this.$refs.canvas.height);

      // Track: the spiral itself, so turns without data still read as days.
      if (!this.trackPath) this.trackPath = toPath(dayBand(this.q, 0, 1, -BAND, BAND));
      ctx.fillStyle = theme.track;
      for (let g = Math.floor(lo); g <= Math.floor(hi); g++) {
        ctx.setTransform(...dayTransform(v, g, DPR));
        const a = Math.max(0, lo - g);
        const b = Math.min(1, hi - g);
        if (a === 0 && b === 1) ctx.fill(this.trackPath);
        else if (b > a) ctx.fill(toPath(dayBand(this.q, a, b, -BAND, BAND)));
      }

      // Activity
      const loader: DayLoader | null = this.loader;
      const focusTop = this.isolate || this.hoverTop;
      if (loader) {
        for (let d = activityDay(lo, this.offset); d <= activityDay(hi, this.offset); d++) {
          const day = loader.days.get(d);
          if (!day) continue;
          ctx.setTransform(...dayTransform(v, d, DPR));
          for (const p of this.pathsFor(day).paths) {
            ctx.globalAlpha = focusTop && p.top !== focusTop ? 0.15 : 1;
            ctx.fillStyle = p.color;
            ctx.fill(p.path);
          }
        }
        ctx.globalAlpha = 1;
      }

      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      // Fade out the turn after the focus, and erase the rest of the last day drawn.
      ctx.globalCompositeOperation = 'destination-out';
      if (hi - v.F > MINUTE) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fill(toPath(screenBand(v, v.F, hi, -0.5, 0.5)));
      }
      ctx.fillStyle = '#000';
      ctx.fill(toPath(screenBand(v, hi, hi + 1, -0.5, 0.5)));
      ctx.globalCompositeOperation = 'source-over';

      // Hovered run
      const hit = this.s.hit;
      if (hit) {
        ctx.strokeStyle = theme.text;
        ctx.lineWidth = 1.5;
        ctx.stroke(toPath(screenBand(v, hit.run.s, hit.run.e, -BAND - 0.03, BAND + 0.03)));
      }

      this.drawDateLabels(lo, Math.min(v.F, now), theme);
      this.drawClock(now, theme);
    },

    drawDateLabels(lo: number, hi: number, theme) {
      const ctx: CanvasRenderingContext2D = this.ctx;
      const v: View = this.view;
      const fmt = new Intl.DateTimeFormat(this.$i18n.locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
      for (let d = Math.ceil(lo); d <= Math.floor(hi); d++) {
        // In the gap between this turn and the one inside it.
        const gap = radius(v, d, -BAND) - radius(v, d, BAND - 1);
        const size = Math.min(13, gap * 0.75);
        if (size < 7) continue;
        ctx.globalAlpha = Math.min(1, (size - 7) / 3);
        this.arcText(
          fmt.format(new Date(L2ms(d + 0.5))),
          d + 0.004,
          -0.5,
          size,
          theme.label,
          theme.font
        );
      }
      ctx.globalAlpha = 1;
    },

    /** Draws text along the spiral, starting at time L0, radial offset k. */
    arcText(text: string, L0: number, k: number, size: number, color: string, font: string) {
      const ctx: CanvasRenderingContext2D = this.ctx;
      const v: View = this.view;
      ctx.font = `${size}px ${font}`;
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      // In the lower half the arc runs right-to-left: lay the glyphs out
      // reversed and turned around, so the label still reads left to right.
      const flip = Math.sin(angle(v, L0 + 0.01)) > 0.15;
      const chars = flip ? [...text].reverse() : [...text];
      let L = L0;
      for (const ch of chars) {
        const w = ctx.measureText(ch).width;
        const r = radius(v, L, k);
        const t = angle(v, L);
        ctx.save();
        ctx.translate(v.cx + r * Math.cos(t), v.cy + r * Math.sin(t));
        ctx.rotate(t + (flip ? -Math.PI / 2 : Math.PI / 2));
        if (flip) ctx.translate(-w, 0);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
        L += w / (TAU * r);
      }
    },

    drawClock(now: number, theme) {
      const ctx: CanvasRenderingContext2D = this.ctx;
      const v: View = this.view;
      // Ticks hug the outermost turn up to the focus: for each hour, the latest such time.
      const day = Math.floor(v.F);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let h = 0; h < 24; h++) {
        const L0 = day + h / 24;
        const L = L0 + Math.floor(v.F - L0);
        const t = angle(v, L);
        const r0 = radius(v, L, 0.5) + 4;
        const major = h % 6 === 0;
        const len = major ? 8 : h % 3 === 0 ? 5 : 3;
        ctx.strokeStyle = theme.tick;
        ctx.lineWidth = major ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(v.cx + r0 * Math.cos(t), v.cy + r0 * Math.sin(t));
        ctx.lineTo(v.cx + (r0 + len) * Math.cos(t), v.cy + (r0 + len) * Math.sin(t));
        ctx.stroke();
        if (h % 3 === 0) {
          const rl = r0 + 18;
          ctx.font = `${major ? 'bold ' : ''}11px ${theme.font}`;
          ctx.fillStyle = major ? theme.text : theme.label;
          ctx.fillText(
            String(h).padStart(2, '0'),
            v.cx + rl * Math.cos(t),
            v.cy + rl * Math.sin(t)
          );
        }
      }

      // Now
      const rn = radius(v, now);
      if (rn > 1 && rn < Math.hypot(this.W, this.H)) {
        const [x, y] = point(v, now);
        const bw = radius(v, now, BAND) - radius(v, now, -BAND);
        ctx.fillStyle = theme.text;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2.5, bw * 0.12), 0, TAU);
        ctx.fill();
      }

      // Focus cursor, when not at now.
      if (now - v.F > MINUTE) {
        const [x0, y0] = point(v, v.F, -0.5);
        const [x1, y1] = point(v, v.F, 0.5);
        ctx.strokeStyle = theme.text;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    },

    // ---- UI outside the canvas ---------------------------------------------------
    updateUi() {
      const s = this.s;
      const now = nowL();
      const loader: DayLoader | null = this.loader;
      this.loading = !!loader && loader.pending.size > 0;
      const d = activityDay(s.F, this.offset);
      const day = loader && loader.days.get(d);
      const key = [
        Math.floor(s.F / MINUTE),
        s.follow,
        d,
        day && day.loadedAt,
        this.$i18n.locale,
        this.colorVersion,
      ].join('|');
      if (key === this.uiKey) return;
      this.uiKey = key;

      const locale = this.$i18n.locale;
      const at = new Date(L2ms(s.F));
      this.focusDate = new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(at);
      this.focusTime = new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
      }).format(at);

      const today = activityDay(now, this.offset);
      this.legendTitle =
        d === today
          ? this.$t('common.today')
          : d === today - 1
          ? this.$t('timespiral.yesterday')
          : new Intl.DateTimeFormat(locale, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            }).format(new Date(L2ms(d + 0.5)));
      if (!day) {
        this.legend = [];
        this.legendTotal = '';
        this.legendEmpty =
          d < this.first ? this.$t('timespiral.noActivity') : this.$t('common.loading');
        return;
      }
      const entries = [...day.totals.entries()].sort((a, b) => b[1] - a[1]);
      const max = entries.length ? entries[0][1] : 1;
      this.legendTotal = fmtDur(entries.reduce((sum, [, x]) => sum + x, 0));
      this.legendEmpty = this.$t('timespiral.noActivity');
      this.legend = entries.map(([cat, x]) => ({
        top: cat,
        color: this.topColor(day, cat),
        dur: fmtDur(x),
        pct: (100 * x) / max,
      }));
    },

    /** Color of a top-level category, or of its first subcategory that day if it isn't one itself. */
    topColor(day: Day, name: string): string {
      const exists = useCategoryStore().classes.some(
        c => c.name.length === 1 && c.name[0] === name
      );
      const run = !exists && day.runs.find(r => r.top === name);
      return this.color(run ? run.cat : [name]);
    },

    toggleIsolate(cat: string) {
      this.isolate = this.isolate === cat ? null : cat;
    },

    setHoverTop(cat: string | null) {
      this.hoverTop = cat;
    },

    refreshHover() {
      const s = this.s;
      const prev = s.hit;
      s.hit = null;
      if (!s.hover || s.dragging) {
        this.tip = null;
        if (prev) this.invalidate();
        return;
      }
      const { x, y } = s.hover;
      const h = hitTest(this.view, x, y);
      const now = nowL();
      const last = Math.min(now, s.F + 1); // nothing is drawn after this
      if (!h || Math.abs(h.k) > 0.5 || h.L > last || h.L < this.first + this.offset) {
        this.tip = null;
        if (prev) this.invalidate();
        return;
      }
      const locale = this.$i18n.locale;
      const clock = (L: number) =>
        new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
          new Date(L2ms(L))
        );
      const when =
        new Intl.DateTimeFormat(locale, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }).format(new Date(L2ms(h.L))) +
        ' ' +
        clock(h.L);
      const day = this.loader && this.loader.days.get(activityDay(h.L, this.offset));
      const found = day && Math.abs(h.k) <= BAND + 0.05 ? findAt(day, h.L) : null;
      const tip: Record<string, any> = { when };
      if (found) {
        const { run, seg } = found;
        s.hit = { run, L: h.L };
        tip.cat = run.cat.join(' › ');
        tip.color = this.color(run.cat);
        tip.span = `${clock(run.s)}–${clock(run.e)} · ${fmtDur(run.e - run.s)}`;
        tip.app = seg ? seg.app : '';
        tip.title = seg ? seg.title : '';
      } else {
        tip.empty = day ? this.$t('timespiral.noActivity') : this.$t('common.loading');
      }
      // Keep the tooltip inside the stage.
      tip.x = Math.max(0, Math.min(x + 14, this.W - 260));
      tip.y = y + 14 > this.H - 90 ? y - 90 : y + 14;
      this.tip = tip;
      if ((prev && prev.run) !== (s.hit && s.hit.run)) this.invalidate();
    },

    // ---- input -------------------------------------------------------------------
    onWheel(e: WheelEvent) {
      const s = this.s;
      if (e.ctrlKey) {
        // Pinch: tighten/loosen the spiral.
        this.q = Math.min(1.45, Math.max(1.06, this.q * Math.exp(-e.deltaY * 0.004)));
        return;
      }
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      const dy = (e.deltaMode === 1 ? 33 : 1) * delta;
      if (e.shiftKey) {
        s.wheelAcc += dy;
        if (Math.abs(s.wheelAcc) > 60) {
          this.stepDays(s.wheelAcc > 0 ? -1 : 1);
          s.wheelAcc = 0;
        }
        return;
      }
      s.tween = null;
      s.follow = false;
      s.Ft -= dy / 2400; // a mouse wheel notch (100) is an hour
      this.invalidate();
    },

    onPointerDown(e: PointerEvent) {
      const s = this.s;
      const v = this.view;
      const rect = this.$refs.canvas.getBoundingClientRect();
      s.dragging = true;
      this.$refs.canvas.setPointerCapture(e.pointerId);
      s.dragPhi = Math.atan2(e.clientY - rect.top - v.cy, e.clientX - rect.left - v.cx);
      s.dragT = performance.now();
      s.tween = null;
      s.vel = 0;
      s.follow = false;
      s.Ft = s.F;
      this.invalidate();
    },

    onPointerMove(e: PointerEvent) {
      const s = this.s;
      const v = this.view;
      const rect = this.$refs.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (s.dragging) {
        const phi = Math.atan2(y - v.cy, x - v.cx);
        let dphi = phi - s.dragPhi;
        if (dphi > Math.PI) dphi -= TAU;
        if (dphi < -Math.PI) dphi += TAU;
        s.dragPhi = phi;
        // Rotating with time: dragging clockwise winds time back. Fixed clock: forward.
        const dF = ((s.m > 0.5 ? -1 : 1) * dphi) / TAU;
        const t = performance.now();
        const dt = Math.max(1, t - s.dragT) / 1000;
        s.dragT = t;
        s.vel = s.vel * 0.6 + (dF / dt) * 0.4;
        s.Ft = s.F = Math.min(Math.max(s.F + dF, this.first + this.offset), nowL());
      }
      s.hover = { x, y };
      this.invalidate();
    },

    endDrag() {
      const s = this.s;
      if (!s.dragging) return;
      s.dragging = false;
      // Only fling if the pointer was still moving when released.
      if (performance.now() - s.dragT > 80) s.vel = 0;
      this.invalidate();
    },

    onPointerLeave() {
      this.s.hover = null;
      this.invalidate();
    },

    onDblClick(e: MouseEvent) {
      const rect = this.$refs.canvas.getBoundingClientRect();
      const h = hitTest(this.view, e.clientX - rect.left, e.clientY - rect.top);
      if (h && Math.abs(h.k) <= 0.5) this.flyTo(h.L, 900);
    },

    onKeyDown(e: KeyboardEvent) {
      const base = this.base();
      switch (e.key) {
        case 'ArrowLeft':
          this.flyTo(base - 1 / 24, 300);
          break;
        case 'ArrowRight':
          this.flyTo(base + 1 / 24, 300);
          break;
        case 'ArrowDown':
          this.flyTo(base - 1, 650);
          break;
        case 'ArrowUp':
          this.flyTo(base + 1, 650);
          break;
        case 'PageDown':
          this.flyTo(base - 7, 1000);
          break;
        case 'PageUp':
          this.flyTo(base + 7, 1000);
          break;
        case 'n':
        case 'Home':
          this.goNow();
          break;
        case 'Escape':
          this.isolate = null;
          break;
        default:
          return;
      }
      e.preventDefault();
    },
  },
};
</script>

<style scoped lang="scss">
.timespiral {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.ts-stage {
  position: relative;
  flex: 1 1 480px;
  min-width: 0;
  height: min(80vh, 760px);
  min-height: 360px;

  canvas {
    display: block;
    touch-action: none;
    cursor: grab;
    outline: none;

    &:active {
      cursor: grabbing;
    }
  }
}

.ts-tip {
  width: 250px;
  font-size: 0.8rem;
  pointer-events: none;

  .popover-body {
    padding: 0.4rem 0.6rem;
  }
}

.ts-tip-cat {
  display: flex;
  align-items: center;
  font-weight: bold;
}

.ts-tip-title {
  overflow-wrap: anywhere;
}

.ts-loading {
  position: absolute;
  left: 0.25rem;
  bottom: 0.25rem;
}

.ts-side {
  flex: 0 1 280px;
  min-width: 240px;
}

.ts-focus-date {
  font-weight: bold;
}

.ts-focus-time {
  font-size: 1.6rem;
  font-variant-numeric: tabular-nums;
}

.ts-controls {
  display: flex;
  align-items: center;
  margin: 0.5rem 0;
}

.ts-depth {
  max-width: 200px;
}

.ts-legend {
  margin-top: 0.75rem;
  font-size: 0.875rem;
}

.ts-legend-head {
  display: flex;
  justify-content: space-between;
  font-weight: bold;
  margin-bottom: 0.25rem;
}

.ts-legend-row {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0.15rem 0.25rem;
  border-radius: 3px;
  cursor: pointer;
  user-select: none;

  &.on {
    outline: 1px solid rgba(128, 128, 128, 0.5);
  }

  &.off {
    opacity: 0.4;
  }
}

.ts-dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  margin-right: 0.4rem;
  flex: none;
}

.ts-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ts-dur {
  font-variant-numeric: tabular-nums;
  margin-left: 0.5rem;
}

.ts-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  opacity: 0.6;
}
</style>
