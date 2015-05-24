// package metadata file for Meteor.js

Package.describe({
  name: 'twbs:bootstrap',  // http://atmospherejs.com/twbs/bootstrap
  summary: 'The most popular front-end framework for developing responsive, mobile first projects on the web.',
  version: '3.3.4',
  git: 'https://github.com/twbs/bootstrap.git'
});

Package.onUse(function (api) {
  api.versionsFrom('METEOR@1.0');
  api.use('jquery', 'client');
  api.addFiles([
    'dist/fonts/glyphicons-halflings-regular.eot',
    'dist/fonts/glyphicons-halflings-regular.svg',
    'dist/fonts/glyphicons-halflings-regular.ttf',
    'dist/fonts/glyphicons-halflings-regular.woff',
    'dist/fonts/glyphicons-halflings-regular.woff2',
    'dist/css/bootstrap.css',
    'dist/js/bootstrap.js',
  ], 'client');
});

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJib290c3RyYXAvcGFja2FnZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBwYWNrYWdlIG1ldGFkYXRhIGZpbGUgZm9yIE1ldGVvci5qc1xuXG5QYWNrYWdlLmRlc2NyaWJlKHtcbiAgbmFtZTogJ3R3YnM6Ym9vdHN0cmFwJywgIC8vIGh0dHA6Ly9hdG1vc3BoZXJlanMuY29tL3R3YnMvYm9vdHN0cmFwXG4gIHN1bW1hcnk6ICdUaGUgbW9zdCBwb3B1bGFyIGZyb250LWVuZCBmcmFtZXdvcmsgZm9yIGRldmVsb3BpbmcgcmVzcG9uc2l2ZSwgbW9iaWxlIGZpcnN0IHByb2plY3RzIG9uIHRoZSB3ZWIuJyxcbiAgdmVyc2lvbjogJzMuMy40JyxcbiAgZ2l0OiAnaHR0cHM6Ly9naXRodWIuY29tL3R3YnMvYm9vdHN0cmFwLmdpdCdcbn0pO1xuXG5QYWNrYWdlLm9uVXNlKGZ1bmN0aW9uIChhcGkpIHtcbiAgYXBpLnZlcnNpb25zRnJvbSgnTUVURU9SQDEuMCcpO1xuICBhcGkudXNlKCdqcXVlcnknLCAnY2xpZW50Jyk7XG4gIGFwaS5hZGRGaWxlcyhbXG4gICAgJ2Rpc3QvZm9udHMvZ2x5cGhpY29ucy1oYWxmbGluZ3MtcmVndWxhci5lb3QnLFxuICAgICdkaXN0L2ZvbnRzL2dseXBoaWNvbnMtaGFsZmxpbmdzLXJlZ3VsYXIuc3ZnJyxcbiAgICAnZGlzdC9mb250cy9nbHlwaGljb25zLWhhbGZsaW5ncy1yZWd1bGFyLnR0ZicsXG4gICAgJ2Rpc3QvZm9udHMvZ2x5cGhpY29ucy1oYWxmbGluZ3MtcmVndWxhci53b2ZmJyxcbiAgICAnZGlzdC9mb250cy9nbHlwaGljb25zLWhhbGZsaW5ncy1yZWd1bGFyLndvZmYyJyxcbiAgICAnZGlzdC9jc3MvYm9vdHN0cmFwLmNzcycsXG4gICAgJ2Rpc3QvanMvYm9vdHN0cmFwLmpzJyxcbiAgXSwgJ2NsaWVudCcpO1xufSk7XG4iXSwiZmlsZSI6ImJvb3RzdHJhcC9wYWNrYWdlLmpzIiwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=