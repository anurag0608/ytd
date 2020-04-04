const express    = require('express'),
      app        = express(),
      bodyParser = require('body-parser'),
      fs         = require('fs'),
      readline   = require('readline'),
      path       = require('path')
      ytdl       = require('ytdl-core'),
      ffmpegPath = require('@ffmpeg-installer/ffmpeg').path,
      ffmpeg     = require('fluent-ffmpeg'),
      ffmpeg.setFfmpegPath(ffmpegPath),
      compression = require('compression'),
      randomstring = require('randomstring'),
      shouldCompress = (req, res) => {
          if (req.headers['x-no-compression']) {
            // don't compress responses if this request header is present
            return false;
          }
          // fallback to standard compression
          return compression.filter(req, res);
        };
        app.set('trust proxy', 1);
        app.set('view engine','ejs');
        app.use(compression({
            filter:shouldCompress,
            threshold: 3
        }));
        app.use(express.static('public'));
        app.use(bodyParser.urlencoded({extended: true}));
        app.disable('x-powered-by');

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
app.get('/download',(req, res)=>{
  const quality = req.query.quality;
  const url = req.query.from;
  const itags = new Map([['1080p','137'],['720p','136'],['480p','135'],['360p','18']]);
// merge audio and video for 1080p
    console.log("Downloading audio..")
    const audioOutput = path.resolve(__dirname,`/${randomstring.generate(5)}.mp4`),
    mainOutput = path.resolve(__dirname,`/${randomstring.generate(5)}.mp4`);

    const onProgress = (chunkLength, downloaded, total) => {
      const percent = downloaded / total;
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
              
              res.attachment(`${req.query.title}.mp4`)

                fs.unlink(audioOutput,err=>{
                    if(err) console.log(err);
                    else
                    console.log('\nFinished merging video and audio')
                    fs.createReadStream(mainOutput).on('end',()=>{
                        fs.unlink(mainOutput,err=>{
                          if(err) console.log(err)
                          else{
                            console.log("Output file removed")
                          }
                        })
                      }).pipe(res,{end:true});
                    })
                })
            })
        
})
app.listen(3000,()=> console.log("Server is started!"));