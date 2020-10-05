<template lang="pug">
  div
    b-alert(v-if="isPollVisible", variant="info", show)
      form
        p
          | Hey there! You've been using ActivityWatch for a while. How likely are you to recommend it to a friend/colleague (10 being most likely)?
        div(class="radio-options")
          div(v-for="i in options", class="option-group")
            input(type="radio", :id="'option' + i", name="rating")
            br
            label(:for="'option' + i", style="display: block")
              | {{ i }}
        input(type="submit" value="Submit")

    b-alert(v-if="isPosFollowUpVisible", variant="info" show)
      | We're really happy to hear you are enjoying ActivityWatch, but we think we can do even better! To help us help you, here are a few things you can do:
      ul
        li
          | Support us on #[a(href="https://www.patreon.com/erikbjare") Patreon] or #[a(href="https://opencollective.com/activitywatch") Open Collective]
        li 
          | If you're using ActivityWatch in the workplace, consider asking your employer to support us!
        li 
          | Tell your friends and coworkers! Post about it on social media, we are on #[a(href="https://twitter.com/ActivityWatchIt") Twitter] and #[a(href="https://www.facebook.com/ActivityWatch") Facebook]
        li 
          | Sign up for the newsletter
        li 
          | Vote for new features on the #[a(href="https://forum.activitywatch.net/c/features") forum]
        li 
          | Fill out the #[a(href="https://forms.gle/q2N9K5RoERBV8kqPA") feedback form]
        li 
          | Rate us on #[a(href="https://alternativeto.net/software/activitywatch/") AlternativeTo]
        li 
          | Star us on #[a(href="https://github.com/ActivityWatch/activitywatch") GitHub]

    b-alert(v-if="isNegFollowUpVisible", variant="info" show)
      | We are sorry to hear that you did not enjoy using ActivityWatch, but we want to improve! We would be vary thankful if you help us by:
      ul
        li
          | Fill out the #[a(href="https://forms.gle/q2N9K5RoERBV8kqPA") feedback form]
        li
          | Vote for new features on the #[a(href="https://forum.activitywatch.net/c/features") forum]
</template>

<style scoped>
.radio-options {
  display: flex;
  justify-content: space-around;
}

.option-group {
  text-align: center;
}

ul {
  margin: 0;
}
</style>

<script>
const NUM_OPTIONS = 10;

export default {
  name: 'user-satisfaction-poll',
  data() {
    return {
      isPollVisible: true,
      isPosFollowUpVisible: true,
      isNegFollowUpVisible: true,
      // options is an array of [1, ..., NUM_OPTIONS]
      options: Array.from({ length: NUM_OPTIONS }, (_, i) => i + 1),
    };
  },
};
</script>
