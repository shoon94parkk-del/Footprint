const {spawn}=require('child_process');

const child=spawn(process.execPath,['server4.js'],{stdio:'inherit'});
child.on('exit',code=>process.exit(code??1));
