<template lang="pug">
div
  b-input-group(size="sm")
    b-input-group-prepend
      span.input-group-text
        | Bucket
    b-dropdown(:text="editorBucketId || 'Select editor watcher bucket'", size="sm", variant="outline-secondary")
      b-dropdown-header
        | Editor bucket to use
      b-dropdown-item(v-if="editorBuckets.length <= 0", name="b", disabled)
        | No editor buckets available
        br
        small Make sure you have an editor watcher installed to use this feature
      b-dropdown-item-button(v-for="editorBucket in editorBuckets", :key="editorBucket", @click="editorBucketId = editorBucket")
        | {{ editorBucket }}

  br

  h6 Active editor time: {{ editor_duration | friendlyduration }}

  div(v-if="editorBucketId")
    div.row(style="padding-top: 0.5em;")
      div.col-md-4
        h5 Top file activity
        aw-summary(:fields="top_editor_files", :namefunc="top_editor_files_namefunc", :colorfunc="top_editor_files_colorfunc", with_limit)

      div.col-md-4
        h5 Top language activity
        aw-summary(:fields="top_editor_languages", :namefunc="top_editor_languages_namefunc", :colorfunc="top_editor_languages_colorfunc", with_limit)

      div.col-md-4
        h5 Top project activity
        aw-summary(:fields="top_editor_projects", :namefunc="top_editor_projects_namefunc", :colorfunc="top_editor_projects_colorfunc", with_limit)
</template>

<script>
import moment from 'moment';
import { get_day_period } from "~/util/time.js";
import query from '~/queries.js';


export default {
  name: "Activity",
  props: ['host', 'date'],
  data: () => {
    return {
      editorBuckets: [],
      editorBucketId: "",

      editor_duration: 0,

      top_editor_files: [],
      top_editor_files_namefunc: (e) => {
        let f = e.data.file || "";
        f = f.split("/");
        f = f[f.length-1];
        return f;
      },
      top_editor_files_colorfunc: (e) => e.data.language,

      top_editor_languages: [],
      top_editor_languages_namefunc: (e) => e.data.language,
      top_editor_languages_colorfunc: (e) => e.data.language,

      top_editor_projects: [],
      top_editor_projects_namefunc: (e) => {
        let f = e.data.project || "";
        f = f.split("/");
        f = f[f.length-1];
        return f;
      },
      top_editor_projects_colorfunc: (e) => e.data.project,
    }
  },
  watch: {
    '$route': function() {
      console.log("Route changed");
      this.refresh();
    },
    editorBucketId() {
      this.queryEditorActivity();
    },
  },

  computed: {
    dateEnd: function() { return moment(this.date).add(1, 'days').format() },
    dateShort: function() { return moment(this.date).format("YYYY-MM-DD") },
  },

  mounted: function() {
    this.getEditorBucket();
    this.refresh();
  },

  methods: {
    refresh: function() {
      this.queryEditorActivity();
    },

    getEditorBucket: async function() {
      let buckets = await this.$aw.getBuckets().catch(this.errorHandler);
      for (var bucket in buckets){
        if (buckets[bucket]["type"] === "app.editor.activity"){
          this.editorBuckets.push(bucket);
        }
      }
      if (this.editorBuckets.length > 0){
        this.editorBucketId = this.editorBuckets[0]
      }
    },

    queryEditorActivity: async function() {
      if (this.editorBucketId !== ""){
        var periods = [get_day_period(this.date)];
        var q = query.editorActivityQuery(this.editorBucketId, 100);
        let data = (await this.$aw.query(periods, q).catch(this.errorHandler))[0];
        this.editor_duration = data["duration"];
        this.top_editor_files = data["files"];
        this.top_editor_languages = data["languages"];
        this.top_editor_projects = data["projects"];
      }
    },
  },
}
</script>
