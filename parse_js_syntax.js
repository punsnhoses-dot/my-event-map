const fs = require('fs');
try{
  const code = fs.readFileSync('c:/Users/scott.carmichael/Downloads/test/events.js','utf8');
  new Function(code);
  console.log('PARSE OK');
}catch(e){
  console.error('PARSE ERR');
  console.error(e.stack || e);
  process.exit(1);
}