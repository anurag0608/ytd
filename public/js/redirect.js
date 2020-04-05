$(document).ready(()=>{
    const bar = $('#js-progressbar')
    const btn = $('#autofire')
    const data = {
        quality: $(btn).attr('quality'),
        url: $(btn).attr('url'),
        title: $(btn).text(),
    }
    console.log(data)
    const socket = io.connect(`${window.location.host}`)
    let statusFlag = false
    
    socket.emit('downloadInfo',data);

   
    
    socket.on('progress',progress=>{
        console.log(progress)
        if(!statusFlag){ console.log("Downloading audio now..."); statusFlag=true}
        if(progress.progress === 50){ 
            console.log("Downloading video now..")
            bar.attr('value',0)
        }
          bar.attr('value',progress.progress)
       
    })
    socket.on('downloadlink',(link)=>{
        window.location.href = link
    })
   
})