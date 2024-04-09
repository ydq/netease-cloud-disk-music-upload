import { createApp } from 'vue'
import App from '/src/App.vue'
import router from '/src/router'
import 'ant-design-vue/dist/reset.css'


createApp(App)
    .use(router)
    .mount('#app')
