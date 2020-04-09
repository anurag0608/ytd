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
    const $ = jQuery.noConflict();
    const bar = $('#js-progressbar')
    const btn = $('#autofire')
    const downloadStatus = $('#downloadStatus')
    const data = {
        quality: $(btn).attr('quality'),
        url: $(btn).attr('url'),
        title: $(btn).text(),
    }
    let interval = null
    console.log(data)
    const socket = io.connect(`${window.location.host}`)
    let statusFlag = false

    if(data.url&&data.quality&&data.title){
        let i=0;
        givesomefacts()
        socket.emit('downloadInfo',data);
        socket.on('progress',progress=>{
            
            console.log(progress.progress)
            if(!statusFlag){ 
                $(downloadStatus).addClass('tracking-in-expand')
                $(downloadStatus).text('Downloading audio now...') 
                statusFlag=true
            }
            if(progress.progress == 100){ 
               
                console.log("audio donneee")
                $(downloadStatus).removeClass('tracking-in-expand')
                $(downloadStatus).addClass('tracking-out-contract')
                if(i!=1){
                    setTimeout(()=>{
                        $(downloadStatus).removeClass('tracking-out-contract')
                        $(downloadStatus).addClass('tracking-in-expand')
                        $(downloadStatus).text('Downloading video now...')
                        i=1;
                    },1000)
                }
                else{
                    $(downloadStatus).removeClass('tracking-in-expand')
                    $(downloadStatus).addClass('tracking-out-contract')
                    setTimeout(()=>{
                        $(downloadStatus).removeClass('tracking-out-contract')
                        $(downloadStatus).addClass('tracking-in-expand')
                        $(downloadStatus).text('Merging audio and video... Please wait')
                    },1000)
                    
    
                }
              
                bar.attr('value',0)
            }
              bar.attr('value',progress.progress)
           
        })

    }
   
    socket.on('downloadlink',(link)=>{
        clearInterval(interval)
        window.location.href = link
    })
    socket.on('redirect',link=>{
        clearInterval(interval)
        window.location.href = link
    })
  
})