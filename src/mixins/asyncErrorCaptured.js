// This mixin fixes following issue: errorHandler does not work with async component methods.
// Fixing that issue is required for the ErrorBoundary component to work correctly.
//
// First I tried https://github.com/vuejs/vue/issues/7653
// That didn't work, so I then tried: https://markeev.com/posts/vue-error-handling/
// Which seems to work! (as long as you mark all functions as async and use await properly)

function handleError(error, vm, info) {
  let cur = vm;
  while ((cur = cur.$parent)) {
    // A single hook is a function, several (e.g. from mixins) an array
    const hooks = [].concat(cur.$options.errorCaptured || []);
    for (const hook of hooks) if (hook.call(cur, error, vm, info) === false) return;
  }
}

export default {
  // Wraps this instance's methods (not the component's shared $options, which
  // Vue 3 caches per component type), once they've been bound in `created`.
  created: function () {
    const methods = this.$options.methods || {};
    for (const key of Object.keys(methods)) {
      const original = this[key];
      if (typeof original !== 'function') continue;
      this[key] = (...args) => {
        try {
          const result = original(...args);
          // let's analyse what is returned from the method
          if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
            // this looks like a Promise. let's handle it's errors:
            return result.catch(err => {
              handleError(err, this, key);
            });
          } else return result;
        } catch (e) {
          handleError(e, this, key);
        }
      };
    }
  },
};
