module.exports = function(grunt) {
  
  grunt.initConfig({
    'watch': {
      files: ['static/src/**'],
      tasks: ['closure-compiler', 'compass']
    },
    'closure-compiler': {
      frontend: {
        closurePath: '/home/ian/apps/closure-compiler',
        js: [
          'static/src/js/specificity.js',
          'static/src/js/compare.js',
          'static/src/js/main.js',
          ],
        jsOutputFile: 'static/js/main.min.js',
        sourceMapUrl: true,
        maxBuffer: 500,
        options: {
          compilation_level: 'SIMPLE_OPTIMIZATIONS',
          language_in: 'ECMASCRIPT5_STRICT',
          create_source_map: 'static/js/src.map',
          source_map_format: 'V3'
        }
      }
    },
    'compass': {
      dist: {
        options: {
          config: 'config.rb'
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-closure-compiler');
  grunt.loadNpmTasks('grunt-contrib-compass');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('default', ['closure-compiler', 'compass']);
}
