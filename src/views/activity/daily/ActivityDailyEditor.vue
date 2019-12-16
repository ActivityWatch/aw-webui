<template lang="pug">
div
  // TODO: Add back option to choose a specific editor bucket
  div(v-if="editorBuckets.length <= 0")
    h6 No editor buckets available
    small Make sure you have an editor watcher installed to use this feature
  div(v-if="editorBuckets.length")
    h6 Active editor time: {{ $store.state.activity_daily.editor_duration | friendlyduration }}
    div.row(style="padding-top: 0.5em;")
      div.col-md-4
        h5 Top file activity
        aw-summary(:fields="$store.state.activity_daily.top_editor_files",
                   :namefunc="top_editor_files_namefunc",
                   :colorfunc="top_editor_files_colorfunc", with_limit)

      div.col-md-4
        h5 Top language activity
        aw-summary(:fields="$store.state.activity_daily.top_editor_languages",
                   :namefunc="top_editor_languages_namefunc",
                   :colorfunc="top_editor_languages_colorfunc", with_limit)

      div.col-md-4
        h5 Top project activity
        aw-summary(:fields="$store.state.activity_daily.top_editor_projects",
                   :namefunc="top_editor_projects_namefunc",
                   :colorfunc="top_editor_projects_colorfunc", with_limit)
  br
</template>

<script>
import moment from 'moment';

export default {
  name: "Activity",
  props: {
    periodLength: {
      type: String,
      default: 'day',
    },
  },
  data: () => {
    return {
      top_editor_files_namefunc: (e) => {
        let f = e.data.file || "";
        f = f.split("/");
        f = f[f.length-1];
        return f;
      },
      top_editor_files_colorfunc: (e) => e.data.language,

      top_editor_languages_namefunc: (e) => e.data.language,
      top_editor_languages_colorfunc: (e) => e.data.language,

      top_editor_projects_namefunc: (e) => {
        let f = e.data.project || "";
        f = f.split("/");
        f = f[f.length-1];
        return f;
      },
      top_editor_projects_colorfunc: (e) => e.data.project,
    }
  },

  computed: {
    editorBuckets: function() {
      return this.$store.state.activity_daily.editor_buckets_available
    },
    dateEnd: function() { return moment(this.date).add(1, 'days').format() },
    dateShort: function() { return moment(this.date).format("YYYY-MM-DD") },
  },
}
</script>
