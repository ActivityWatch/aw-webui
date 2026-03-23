<template>
  <font-awesome-icon v-if="faIcon" :icon="faIcon" :style="iconStyle" class="me-1" />
  <span v-else class="icon-placeholder" :data-icon="name"></span>
</template>

<script>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';

// Solid icons
import {
  faAnglesDown,
  faAnglesUp,
  faArrowLeft,
  faArrowRight,
  faBars,
  faBug,
  faCalendar,
  faCalendarDay,
  faCalendarWeek,
  faCaretRight,
  faChartLine,
  faChartPie,
  faCheck,
  faCircle,
  faCircleNodes,
  faClock,
  faCode,
  faDatabase,
  faDesktop,
  faDownload,
  faEllipsis,
  faFilter,
  faFlagCheckered,
  faFloppyDisk,
  faFolderOpen,
  faGear,
  faHandHoldingHeart,
  faHeart,
  faClockRotateLeft,
  faCircleInfo,
  faMobileScreenButton,
  faPenToSquare,
  faPlay,
  faPlus,
  faDiagramProject,
  faQuestion,
  faCircleQuestion,
  faRotateLeft,
  faMagnifyingGlass,
  faSpinner,
  faStop,
  faStopwatch,
  faBarsStaggered,
  faArrowsRotate,
  faTags,
  faXmark,
  faScrewdriverWrench,
  faTrash,
  faTriangleExclamation,
  faCheckToSlot,
} from '@fortawesome/free-solid-svg-icons';

// Regular icons
import { faSquareMinus, faSquarePlus } from '@fortawesome/free-regular-svg-icons';

// Brand icons
import { faGithub, faTwitter } from '@fortawesome/free-brands-svg-icons';

// Register all icons with the library
library.add(
  faAnglesDown,
  faAnglesUp,
  faArrowLeft,
  faArrowRight,
  faBars,
  faBug,
  faCalendar,
  faCalendarDay,
  faCalendarWeek,
  faCaretRight,
  faChartLine,
  faChartPie,
  faCheck,
  faCircle,
  faCircleNodes,
  faClock,
  faCode,
  faDatabase,
  faDesktop,
  faDownload,
  faEllipsis,
  faFilter,
  faFlagCheckered,
  faFloppyDisk,
  faFolderOpen,
  faGear,
  faHandHoldingHeart,
  faHeart,
  faClockRotateLeft,
  faCircleInfo,
  faMobileScreenButton,
  faPenToSquare,
  faPlay,
  faPlus,
  faDiagramProject,
  faQuestion,
  faCircleQuestion,
  faRotateLeft,
  faMagnifyingGlass,
  faSpinner,
  faStop,
  faStopwatch,
  faBarsStaggered,
  faArrowsRotate,
  faTags,
  faXmark,
  faScrewdriverWrench,
  faTrash,
  faTriangleExclamation,
  faCheckToSlot,
  faSquareMinus,
  faSquarePlus,
  faGithub,
  faTwitter
);

// Map vue-awesome icon names to Font Awesome 6 icon specs
const iconMap = {
  'angle-double-down': ['fas', 'angles-down'],
  'angle-double-up': ['fas', 'angles-up'],
  'arrow-left': ['fas', 'arrow-left'],
  'arrow-right': ['fas', 'arrow-right'],
  bars: ['fas', 'bars'],
  'brands/github': ['fab', 'github'],
  'brands/twitter': ['fab', 'twitter'],
  bug: ['fas', 'bug'],
  calendar: ['fas', 'calendar'],
  'calendar-day': ['fas', 'calendar-day'],
  'calendar-week': ['fas', 'calendar-week'],
  'caret-right': ['fas', 'caret-right'],
  'chart-line': ['fas', 'chart-line'],
  'chart-pie': ['fas', 'chart-pie'],
  check: ['fas', 'check'],
  circle: ['fas', 'circle'],
  'circle-nodes': ['fas', 'circle-nodes'],
  clock: ['fas', 'clock'],
  code: ['fas', 'code'],
  cog: ['fas', 'gear'],
  database: ['fas', 'database'],
  desktop: ['fas', 'desktop'],
  download: ['fas', 'download'],
  edit: ['fas', 'pen-to-square'],
  'ellipsis-h': ['fas', 'ellipsis'],
  'exclamation-triangle': ['fas', 'triangle-exclamation'],
  filter: ['fas', 'filter'],
  'flag-checkered': ['fas', 'flag-checkered'],
  'folder-open': ['fas', 'folder-open'],
  'hand-holding-heart': ['fas', 'hand-holding-heart'],
  heart: ['fas', 'heart'],
  history: ['fas', 'clock-rotate-left'],
  'info-circle': ['fas', 'circle-info'],
  mobile: ['fas', 'mobile-screen-button'],
  play: ['fas', 'play'],
  plus: ['fas', 'plus'],
  'project-diagram': ['fas', 'diagram-project'],
  question: ['fas', 'question'],
  'question-circle': ['fas', 'circle-question'],
  'regular/minus-square': ['far', 'square-minus'],
  'regular/plus-square': ['far', 'square-plus'],
  save: ['fas', 'floppy-disk'],
  search: ['fas', 'magnifying-glass'],
  spinner: ['fas', 'spinner'],
  stop: ['fas', 'stop'],
  stopwatch: ['fas', 'stopwatch'],
  stream: ['fas', 'bars-staggered'],
  sync: ['fas', 'arrows-rotate'],
  tags: ['fas', 'tags'],
  times: ['fas', 'xmark'],
  tools: ['fas', 'screwdriver-wrench'],
  trash: ['fas', 'trash'],
  undo: ['fas', 'rotate-left'],
  'vote-yea': ['fas', 'check-to-slot'],
};

export default {
  name: 'AwIcon',
  components: { FontAwesomeIcon },
  props: {
    name: {
      type: String,
      default: '',
    },
    scale: {
      type: [Number, String],
      default: 1,
    },
  },
  computed: {
    faIcon() {
      return iconMap[this.name] || null;
    },
    iconStyle() {
      const s = parseFloat(this.scale);
      if (s && s !== 1) {
        return { fontSize: `${s}em` };
      }
      return {};
    },
  },
};
</script>
