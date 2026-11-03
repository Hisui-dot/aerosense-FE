fetch('https://aerosense-iot.vercel.app/').then(r=>r.text()).then(t=>{
  const m=t.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if(m) {
    fetch('https://aerosense-iot.vercel.app'+m[1]).then(r=>r.text()).then(js=>{
      console.log('u67m:', js.includes('aerosense-u67m'));
      console.log('u67n:', js.includes('aerosense-u67n'));
      console.log('localhost:', js.includes('localhost:8001/api'));
    });
  } else console.log('no match');
});
