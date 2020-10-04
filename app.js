const express    = require('express'),
      app        = express(),
      bodyParser = require('body-parser'),
      fs         = require('fs'),
      jwt        = require('jsonwebtoken'),
      readline   = require('readline'),
      path       = require('path'),
      moment     = require('moment'),
      dotenv     = require('dotenv'),
    cookieParser = require('cookie-parser')
      worker     = require('./worker'),
      ytdl       = require('ytdl-core'),
      io         = require('socket.io'),
      ffmpegPath = require('@ffmpeg-installer/ffmpeg').path,
      ffmpeg     = require('fluent-ffmpeg');
      ffmpeg.setFfmpegPath(ffmpegPath),
      randomstring = require('randomstring'),
        app.set('trust proxy', 1);
        app.set('view engine','ejs');
        app.use(express.static('public'));
        app.use(cookieParser());
        app.use(bodyParser.urlencoded({extended: true}));
        app.disable('x-powered-by');

        dotenv.config();      
        //start the worker (will delete files which are kept for longer than 30mins)
        worker.start()
        app.use('/robots.txt',(rea,res)=>{
          res.type('text/plain');
          res.send("User-agent: *\nAllow: /\nAllow: /about\nDisallow: /videoinfo\nDisallow: /audiostream\nDisallow: /redirect?quality=\nDisallow: /downloadit?token=");
        })
        // creating temp folder for video caching
        const dir = './temp_vid';
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
//REST APIs
app.get('/',(req, res)=>{
    res.render('index')
})
app.get('/about',(req, res)=>{
  res.render('about')
})
app.post('/videoinfo',async (req, res)=>{
  const url = req.body.url.trim();
  // console.log(url)
  console.log('getting info about url...')
    await ytdl.getBasicInfo(url.toString())
    .then(info=>{
      const length = info.player_response.videoDetails.lengthSeconds
        console.log(length)
        if(length>420){ //if videolength is greated then 7mins
            //limit audio download to 20mins and give only audio downoad option
            if(length<1200){
              res.send({'code':"405",'err':"Videos with duration greater than 7mins are locked.... Will be available in future. For now you can download audio only for this video",
              'audioinfo':{
                  "thumbnail": info.player_response.microformat.playerMicroformatRenderer.thumbnail.thumbnails[0].url,
                  "author" : info.author.name,
                  "title":info.player_response.videoDetails.title,
                  "channel_url": info.author.channel_url,
              }});
            }else{
              res.send({'code':'40X','err':"Audios with duration greater than 20mins are locked... Will be available in future."})
            }
         
        }else{
              const _qualities = []
              info.formats.forEach(format=>{
                if(format.qualityLabel && 
                  (format.qualityLabel == '1080p' || format.qualityLabel=='720p'||
                  format.qualityLabel=='480p'||format.qualityLabel=='360p'))
                _qualities.push(format.qualityLabel);
              });
              let unique = [...new Set(_qualities)];
              //console.log(unique)
              const details = {
                  thumbnail: info.player_response.microformat.playerMicroformatRenderer.thumbnail.thumbnails[0].url,
                  author : info.author.name,
                  title:info.player_response.videoDetails.title,
                  channel_url: info.author.channel_url,
                  availQuality: unique
              }
              res.send(JSON.stringify(details,null,2))
        }
    })
    .catch(err=>{
      res.send({"err":"Invalid or empty URL.Please enter a valid YouTube URL"})
    })
  })
app.get('/audiostream',async (req,res)=>{
    const quality = req.query.quality,
          url     = req.query.from,
          title   = req.query.title;
        if(quality&&url&&title){
          await ytdl.getBasicInfo(url)
          .then(info=>{
            const length = info.player_response.videoDetails.lengthSeconds
            console.log(length)
            if(length<=1200){
              //if video is less than 20mins download audio 
              const options = {
                filter: format => format.container === 'mp4' && !format.qualityLabel
              }
              res.contentType('audio/mp3')
              res.attachment(`${title}.mp3`)
              ytdl(url,options)
                  .on('end',()=>{
                          //record the last download
                        record_downloads(req)
                  })
                  .pipe(res);
            }else{
                res.redirect('/');
            }
          })
          .catch(err=>{
                console.log({"err":"Invalid or empty URL.Please enter a valid YouTube URL"})
                res.redirect('/')
          })
        }else{
            res.redirect('/')
        }
})
app.get('/redirect',(req, res)=>{
  const quality = req.query.quality;
  const url = req.query.from;
  const title = req.query.title;
  if(quality&&url&&title)
  res.render('redirect',{quality:quality,url:url,title:title});
  else
    res.redirect('/')
})
app.get('/downloadit',(req, res)=>{
  const token = req.query.token;
  const mainOutput = req.query.output;
  const filename = req.query.filename; //title is the filename
 
 
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded)=>{
      if(err){
        console.log('Link Expired!! :-(');
        res.redirect('/')
        fs.unlink(mainOutput,err=>{
          if(err) console.log(err)
          else{
            console.log("Output file removed --> "+mainOutput)
          }
        })
      } else{
        //console.log(decoded); //{_id: socketid}
        //rename it to that socketid(so that if user closes the tab.. the disconnect event is triggred which will try to delete mainOutput
        // to pass through this problem.. I renamed the file with the socket.id which is always unique for every new connection
        //  in this way if user closes the tab the download will not be intrepted)

         
        //get untransfered.json and add current file to it
        //uncompleted download will be deleted by worker.js
        //which will compare the timestamps and if that file has
        //time difference of more than 30mins then
        //that file will be deleted

            const untransfered = require('./untransfered');
            const pendingFiles = untransfered.locations;
            const fileobj = {
                file:`./temp_vid/${decoded._id}.mp4`,
                timestamp: moment().format()
            }
            pendingFiles.push(fileobj)
            const json  = {
              locations: pendingFiles
            }
            fs.writeFile('./untransfered.json',JSON.stringify(json),err=>{
                if(err) console.log(err)
                else{
                    console.log("Wrote to untransfered.json...\n")
                }
            })

        fs.rename(mainOutput,`./temp_vid/${decoded._id}.mp4`,()=>{
              console.log("File renamed...")
              
              res.attachment(`${filename}.mp4`)
              fs.createReadStream(`./temp_vid/${decoded._id}.mp4`).on('error',err=>{
                console.log('no such file!');
                res.redirect('/')
              }).pipe(res,{end:true})
              .on('end',()=>{
                fs.unlink(`./temp_vid/${decoded._id}.mp4`,err=>{
                  if(err) console.log(err)
                  else{
                    console.log("Output file removed")
                    record_downloads(req)

                    //remove file from untransfered.json
                        // const untransfered_new = require('./untransfered.json')
                        // let pendingObjs  =  untransfered_new.locations;
                        // pendingObjs = pendingObjs.filter((obj)=> obj.file!=`./temp_vid/${decoded._id}.mp4`)
                        // const newjson  = {
                        //   locations: pendingObjs
                        // }
                        // console.log(pendingObjs)
                        // fs.writeFile('./untransfered.json',JSON.stringify(newjson),err=>{
                        //     if(err) console.log(err)
                        //     else{
                        //         console.log("file stamp removed from untransfered.json...\n")

                        //     }
                        // })

                    }
                })
              });
        })
       
    }
  });

  
})
app.get('*',(req,res)=>{
  res.redirect('/')
})
const socketio = io.listen(app.listen(process.env.PORT,(req, res)=>{
    console.log(`Server is started at port ${process.env.PORT}`)
}))
//app.listen(process.env.PORT,()=> console.log("Server is started!"));

//SUB_SERVER//
socketio.sockets.on("connection",(socket)=>{
    console.log(`Connection established ${socket.id}`)
    let mainOutput,audioOutput;
    let disconnected = false;
    
    socket.on('downloadInfo',(data)=>{
      //recheck for video duration
      ytdl.getBasicInfo(data.url, (err, details)=>{
        //console.log(info)
        if(err){
          console.log(err)
          socket.emit('redirect','/')
        }else{
          const length = details.player_response.videoDetails.lengthSeconds
          console.log(length)
            if(length>420){ //if video length greater then 7mins
              socket.emit('redirect','/');
              
            }else{
                    console.log(data)
                    const quality = data.quality;
                    const url = data.url;
                    const title = data.title;
                    const itags = new Map([['1080p','137'],['720p','136'],['480p','135'],['360p','18']]);
                  // merge audio and video for 1080p
                      console.log("Downloading audio..")
                      //temp videos will be store in ./temp_vid
                      audioOutput = path.resolve(`./temp_vid/${randomstring.generate(5)}.mp4`),
                      mainOutput = path.resolve(`./temp_vid/${randomstring.generate(5)}.mp4`);
                      
                      const onProgress = (chunkLength, downloaded, total) => {
                        const percent = downloaded / total;
                        socket.emit('progress',{progress: ((percent * 100).toFixed(2))});
                        readline.cursorTo(process.stdout, 0);
                        process.stdout.write(`${(percent * 100).toFixed(2)}% downloaded `);
                        process.stdout.write(`(${(downloaded / 1024 / 1024).toFixed(2)}MB of ${(total / 1024 / 1024).toFixed(2)}MB)`);
                      };
                      
                      try{
                            if(disconnected) throw new Error("Socket got disconnected..")
                            ytdl(url, {
                              filter: format => format.container === 'mp4' && !format.qualityLabel
                            }).on('error', console.error)
                              .on('progress',onProgress)
                              .pipe(fs.createWriteStream(audioOutput))
                              .on('finish',()=>{
                                  if(!disconnected){
                                    console.log('downloading video..')
                                  
                                    const video = ytdl(url,{
                                        quality:itags.get(quality),
                                        filter: format => format.container === 'mp4' && !format.audioEncoding
                                    });
                                    video
                                    .on('error',console.error)
                                    .on('progress',onProgress);
                                    //now merge the audio and video file
                                    ffmpeg()
                                    .input(video)
                                    .videoCodec('copy')
                                    .input(audioOutput)
                                    .audioCodec('copy')
                                    .save(mainOutput)
                                    .on('error',console.error)
                                    .on('end',()=>{
                                      console.log("ended merging")
                                      
                                    // res.attachment(`${data.title}.mp4`)
                        
                                        fs.unlink(audioOutput,err=>{
                                            if(err) console.log(err);
                                            else{
                                              console.log('\nFinished merging video and audio')
                                              //console.log(mainOutput)
                                              //generate a link with unique token with expiration time of 5mins
                                              const forid = {
                                                _id:socket.id
                                              };
                                              const redirectlink = `/downloadit?token=${generate_token(forid)}&output=${mainOutput}&filename=${title}`
                                              socket.emit('downloadlink',redirectlink);
                                            }
                                          
                                            })
                                        })
                                  }   
                                  })
                      }catch(err){
                        console.log(err)
                      }
                 }
       
        }
    });

      
      
    })
    socket.on('disconnect',()=>{
      disconnected = true;
      console.log('disconnected')
      //delete all files associated with that socket
      //delete afte 0.5s
      setTimeout(()=>{
        try{
          fs.unlink(mainOutput,(err)=>{
            if(err) console.log(err)
            else{
              console.log(`${mainOutput} removed...`)
            }
          })
        }catch(err){
          console.log(err);
        }
        try{
          fs.unlink(audioOutput,err=>{
            if(err) console.error(err);
            else{
              console.log(`Removed audio file... ${audioOutput}`)
            }
          })
        }catch(err){
          console.log(err)
        }
      },0.5)
   
      
    })
  })
const generate_token = (forid)=>{
    const header = { algorithm:"HS512", expiresIn: '300000'  }, //5min
            payload = { _id : forid._id},
            key = process.env.JWT_SECRET;
            const token = jwt.sign(payload, key, header);
            return token;
}
const record_downloads = (req)=>{

  let current_downloads = require('./downloads.json') 
  //{"total_downloads":0,"last_download":{"time_stamp":"TIME_HERE","ip": "ip of last download"}} 
  let downloads = Number(current_downloads.total_downloads)
  let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  downloads++
  let total_downloads_obj = {
    total_downloads: downloads,
    last_download: {
      time_stamp: moment().format(),
      ip: ip
    }
  }
  fs.writeFile('./downloads.json',JSON.stringify(total_downloads_obj),(err)=>{
    if(err) console.log(err)
    else{
        console.log("Downloads added to record and timestap recorded")
    }
  })
}
