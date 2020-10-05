<template lang="pug">
  div
    b-alert(v-if="isVisible", variant="info", show)
      form
        p
          | How likely are you to recommend ActivityWatch to a friend/colleague (10 being most likely)?
        br
        div(class="radio-options")
          div(v-for="i in options" class="option-group")
            input(type="radio" :id="'option' + i" name="rating")
            br
            label(:for="'option' + i" style="display: block")
              | {{ i }}
</template>

<style scoped>
.radio-options {
  display: flex;
  justify-content: space-around;
}

.option-group {
  text-align: center;
}
</style>

<script>
const NUM_OPTIONS = 10;

export default {
  name: 'user-satisfaction-poll',
  data() {
    return {
      isVisible: true,
      // options is an array of [1, ..., NUM_OPTIONS]
      options: Array.from({ length: NUM_OPTIONS }, (_, i) => i + 1),
    };
  },
};
</script>
