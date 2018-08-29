<template lang="pug">

div
  div
    span Show last:
    span
      select(:value="value" @input="$emit('input', $event.target.value)")
        option(:value="15*60") 15min
        option(:value="60*60") 1h
        option(:value="6*60*60") 6h
        option(:value="24*60*60") 24h
</template>

<style scoped lang="scss">

</style>

<script>
export default {
  name: "DateRangeInput",
  props: ["value"],
}
</script>
