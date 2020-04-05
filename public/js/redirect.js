const givesomefacts = ()=>{
    const $ = jQuery.noConflict();
    const facts = $('#random_facts')

    setTimeout(()=>{
        $(facts).addClass('text-blur-out');
    },2000)
    setTimeout(()=>{
        $(facts).removeClass('text-blur-out');
        $(facts).addClass('slide-in-top');
        $(facts).text("Here are some facts for you :)")
    },3000)
    interval = setInterval(()=>{
        console.log('running')
        let random = Math.ceil(Math.random()*(100000)+0)
        $(facts).removeClass('text-focus-in');
        $.get(`http://numbersapi.com/random/year`, function(data) {
            $(facts).removeClass('slide-in-top');
            $(facts).addClass('text-focus-in');
            setTimeout(()=>{
            $(facts).text(data);
            },0.5)
        });
    },5000)
}
$(document).ready(()=>{
    const bar = $('#js-progressbar')
    const btn = $('#autofire')
    const data = {
        quality: $(btn).attr('quality'),
        url: $(btn).attr('url'),
        title: $(btn).text(),
    }
    let interval = null
    console.log(data)
    const socket = io.connect(`${window.location.host}`)
    let statusFlag = false

    if(data.url&&data.quality&&data.title)
    socket.emit('downloadInfo',data);
    givesomefacts()
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
        clearInterval(interval)
    })
  
})