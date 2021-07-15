<template lang="pug">
div.d-flex.justify-content-between
  div
    h5.mb-0 {{ $t('useFallback') }}
    small
      | {{ $t('useOld') }}
  div
    b-form-checkbox(v-model="useColorFallback", switch)
</template>

<script>
export default {
  name: 'ColorSettings',
  data: () => {
    return {
      useColorFallback: localStorage.useColorFallback === 'true',
    };
  },
  watch: {
    useColorFallback(val) {
      localStorage.useColorFallback = val;
      console.log('Set useColorFallback to ' + val);
    },
  },
};
</script>
