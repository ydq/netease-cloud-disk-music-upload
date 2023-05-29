if(window.open('../index.html','ncu')){
    //chrome|edge
    window.close()
} else{
    //firefox
    browser.tabs.create({url: '../index.html'},()=> window.close());
}