module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    concat: {
      dev: {
        dependencies: {
          'dependencies.js' : [
            'bower_components/d3/d3.min.js',
            'bower_components/d3-transform/src/d3-transform.js',
            'bower_components/crossfilter/crossfilter.min.js'
          ]
        },
        files : {
          'index.js': [
            'src/*.js',
          ],
          "index.css" : [
            // 'bower_components/normalize.css/normalize.css',
            'src/*.css'
          ]
        }
      }
    }, //end of concat
    connect: {
        dev: {
          options: {
            port: 8888,
            livereload : true
          }
        }
    }, //end of http-server
    watch : {
      dev: {
        files: ['*.html'],
        tasks: []
      },
      scripts: {
        files: ['src/*'],
        tasks: ['concat:dev:files'],
        options: {
                livereload: true
        }
      }
    }//end of watch
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.registerTask('dev', ['concat:dev', 'connect:dev', 'watch']);
};
