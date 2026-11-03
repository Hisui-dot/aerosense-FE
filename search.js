const js = require('fs').readFileSync('bundle_test.js', 'utf8'); const m = js.match(/const [a-zA-Z0-9_]+="[^"]*?api"/g); console.log(m);
