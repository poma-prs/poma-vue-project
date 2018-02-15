const Vue = require('vue');

// part view components
const app = require('./index.vue');

new Vue({
  el: 'app',
  components: { app: app }
});
