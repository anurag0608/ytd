const express    = require('express'),
      app        = express(),
      bodyParser = require('body-parser'),
      fs         = require('fs'),
      jwt        = require('jsonwebtoken'),
      readline   = require('readline'),
      path       = require('path'),
      dotenv     = require('dotenv'),
      ytdl       = require('ytdl-core'),
      io         = require('socket.io'),
      ffmpegPath = require('@ffmpeg-installer/ffmpeg').path,
      ffmpeg     = require('fluent-ffmpeg');
      ffmpeg.setFfmpegPath(ffmpegPath),
      randomstring = require('randomstring'),
        app.set('trust proxy', 1);
        app.set('view engine','ejs');
        app.use(express.static('public'));
        app.use(bodyParser.urlencoded({extended: true}));
        app.disable('x-powered-by');
dotenv.config();
//REST APIs
app.get('/',(req, res)=>{
  res.render('index');
});
app.post('/videoinfo',(req, res)=>{
const url = req.body.url;
console.log('getting info about url...')
  ytdl.getBasicInfo(url, (err, info)=>{
    //console.log(info)

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
  })
})
app.get('/redirect',(req, res)=>{
  const quality = req.query.quality;
  const url = req.query.from;
  const title = req.query.title;
  res.render('redirect',{quality:quality,url:url,title:title});
})
app.get('/downloadit',(req, res)=>{
  const token = req.query.token;
  const mainOutput = req.query.output;
  const filename = req.query.filename;
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded)=>{
    if(err){
       console.log('Link Expired!! Cannot create account from this token :-(');
       res.send('LINK EXPIRED!!');
       fs.unlink(mainOutput,err=>{
        if(err) console.log(err)
        else{
          console.log("Output file removed")
        }
      })
    } else{
      //console.log(decoded);

      res.attachment(`${filename}.mp4`)
      fs.createReadStream(mainOutput).on('error',err=>{
        console.log('no such file!');
        res.redirect('/')
      }).on('end',()=>{
        fs.unlink(mainOutput,err=>{
          if(err) console.log(err)
          else{
            console.log("Output file removed")
          }
        })
      }).pipe(res,{end:true});
  }
});
})
const socketio = io.listen(app.listen(process.env.PORT,(req, res)=>{
    console.log(`Server is started at port ${process.env.PORT}`)
}))
//app.listen(process.env.PORT,()=> console.log("Server is started!"));

//SUB_SERVER//
socketio.sockets.on("connection",(socket)=>{
    console.log(`Connection established ${socket.id}`)
   
    socket.on('downloadInfo',(data)=>{
      console.log(data)
      const quality = data.quality;
      const url = data.url;
      const title = data.title;
      const itags = new Map([['1080p','137'],['720p','136'],['480p','135'],['360p','18']]);
    // merge audio and video for 1080p
        console.log("Downloading audio..")
        const audioOutput = path.resolve(`./${randomstring.generate(5)}.mp4`),
        mainOutput = path.resolve(`./${randomstring.generate(5)}.mp4`);
        
        const onProgress = (chunkLength, downloaded, total) => {
          const percent = downloaded / total;
          socket.emit('progress',{progress: ((percent * 100).toFixed(2))});
          readline.cursorTo(process.stdout, 0);
          process.stdout.write(`${(percent * 100).toFixed(2)}% downloaded `);
          process.stdout.write(`(${(downloaded / 1024 / 1024).toFixed(2)}MB of ${(total / 1024 / 1024).toFixed(2)}MB)`);
        };
        
        ytdl(url, {
            filter: format => format.container === 'mp4' && !format.qualityLabel
          }).on('error', console.error)
            .on('progress',onProgress)
            .pipe(fs.createWriteStream(audioOutput))
            .on('finish',()=>{
                console.log('downloading video..')
              
                const video = ytdl(url,{
                    quality:itags.get(quality),
                    filter: format => format.container === 'mp4' && !format.audioEncoding
                });
                video.on('progress',onProgress);
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
                        else
                        console.log('\nFinished merging video and audio')
                        //console.log(mainOutput)
                        //generate a link with unique token with expiration time of 5mins
                        const forid = {
                          _id:socket.id
                        };
                        const redirectlink = `/downloadit?token=${generate_token(forid)}&output=${mainOutput}&filename=${title}`
                        socket.emit('downloadlink',redirectlink);
                        })
                    })
                })
    })
    socket.on('disconnect',()=>console.log('disconnected'))
  })
const generate_token = (forid)=>{
    const header = { algorithm:"HS512", expiresIn: '300000'  }, //5min
            payload = { _id : forid._id},
            key = process.env.JWT_SECRET;
            const token = jwt.sign(payload, key, header);
            return token;
}
