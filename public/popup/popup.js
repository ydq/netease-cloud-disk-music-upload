const page = `../${/Android|iPhone|iPad/i.test(navigator.userAgent)?'lite':'index'}.html`
if(window.open(page,'ncu')){
    //chrome|edge
    window.close()
} else{
    //firefox
    browser.tabs.create({url: page},()=> window.close())
}