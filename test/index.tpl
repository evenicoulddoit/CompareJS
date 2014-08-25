<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Compare.js Qunit tests</title>
  <link rel="stylesheet" href="../bower_components/qunit/qunit/qunit.css">
</head>
<body>
  <div id="qunit"></div>
  <div id="qunit-fixture"></div>
  <script src="../src/js/lib/require.js"></script>
  <script src="../bower_components/jquery/dist/jquery.min.js"></script>
  <script src="../bower_components/qunit/qunit/qunit.js"></script>
  <script>
    QUnit.config.autostart = false;
  </script>
  {{TESTS}}
</body>
</html>
