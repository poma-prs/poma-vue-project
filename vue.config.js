module.exports = {
  customCompilers: {
    // for tags with lang="ts"
    ts: function (content, cb, compiler, filePath) {
      // content:  content extracted from lang="ts" blocks
      // cb:       the callback to call when you're done compiling
      // compiler: the vueify compiler instance
      // filePath: the path for the file being compiled
      //
      // compile some TypeScript... and when you're done:
      cb(null, result)
    }
  }
}