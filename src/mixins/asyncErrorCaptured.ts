// This mixin fixes following issue: errorHandler does not work with async component methods.
// Fixing that issue is required for the ErrorBoundary component to work correctly.
//
// First I tried https://github.com/vuejs/vue/issues/7653
// That didn't work, so I then tried: https://markeev.com/posts/vue-error-handling/
// Which seems to work! (as long as you mark all functions as async and use await properly)

import Vue from 'vue';

function handleError(error: unknown, vm: Vue, info: string) {
  let cur: Vue | undefined = vm;
  while ((cur = cur.$parent)) {
    const hooks: any = cur.$options.errorCaptured || [];
    for (const hook of hooks) if (hook.call(cur, error, vm, info) === false) break;
  }
}

export default {
  beforeCreate: function (this: Vue) {
    const that = this;
    const methods = this.$options.methods || {};
    for (const key in methods) {
      const original = methods[key];
      methods[key] = function (...args: any[]) {
        try {
          const result = original.apply(this, args);
          // let's analyse what is returned from the method
          if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
            // this looks like a Promise. let's handle it's errors:
            return result.catch(function (err: unknown) {
              handleError(err, that, key);
            });
          } else return result;
        } catch (e) {
          handleError(e, that, key);
        }
      };
    }
  },
};
