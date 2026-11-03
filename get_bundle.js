fetch('https://aerosense-iot.vercel.app/').then(r=>r.text()).then(t=>{
  const m=t.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if(m) {
    fetch('https://aerosense-iot.vercel.app'+m[1]).then(r=>r.text()).then(js=>{
      const fs = require('fs');
      fs.writeFileSync('bundle_test.js', js);
      console.log('Bundle downloaded!');
    });
  }
});
