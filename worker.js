//this file will remove un transfered file
const fs = require('fs');
const moment = require('moment');
 const untransfered = require('./untransfered');
 console.log(untransfered.locations)
//  let a =moment().format();
//  let b;
//  setTimeout(() => {
//      b = moment().format()
//      x = moment(a)
//      y = moment(b)
//      duration = moment.duration(y.diff(x))
//      console.log(duration.as('seconds'))
//  }, 1000);

 //  console.log(moment().format())
//remove undownloaded files after 30mins
// b = moment().format()
//      x = moment("2020-04-06T18:44:38+05:30")
//      y = moment(b)
//      duration = moment.duration(y.diff(x))
//      console.log(duration.as('minutes'))
// setInterval(() => {
//     untransfered.locations.forEach(location=>{
//         let last = moment(location.timestamp)
//         let now = moment().format();
//         let x = moment(last)
//         let y = moment(now)
//         let duration = moment.duration(y.diff(x))
//         if(duration.as('minutes')>=5){
//             fs.unlink(location.file,(err)=>{
//                 if(err) console.log(err)
//                 else{
//                     console.log(`removed... ${location}`)
                    
//                 }
//             })
//         }
        
//     })
// }, 1000);
