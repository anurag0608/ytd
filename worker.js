//this file will remove un transfered file
const fs = require('fs');
const moment = require('moment');
let interval;
const start = ()=>{
                   interval = setInterval(() => {
                       //don't use require() method as this will cache the json and
                       //when it will be modified we won't be able to see the changes
                            //let untransfered = require('./untransfered');
                            let untransfered = {}
                            fs.readFile('./untransfered.json', 'utf-8', (err, data) => {
                            if (err) console.log(err)
                            else{
                                    untransfered = JSON.parse(data)
                                    console.log(++i)
                                    untransfered.locations.forEach(location=>{
                                        let last = moment(location.timestamp)
                                        let now = moment().format();
                                        let x = moment(last)
                                        let y = moment(now)
                                        let duration = moment.duration(y.diff(x))
                                        if(duration.as('minutes')>30){ //delete the files kept longer than 30mins
                                            fs.unlink(location.file,(err)=>{
                                               if(err) console.log(err)
                                                else{
                                                   console.log(`removed... ${location}`)
                                                    
                                               }
                                            })
                                        }
                                        
                                    })
                            }
                            })
                           
                            },900000); //run in worker in every 15mins
                    }

const stop = ()=>{ clearInterval(interval);}
module.exports = {
    start,stop
}
//900000
