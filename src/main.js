import { createApp } from 'vue'
import App from './App.vue'
import { ConfigProvider, PageHeader, Tabs, Table, Avatar, Progress, Tooltip, Popover, Button, Input, List, Row, Col, Space, Tag, Typography, Divider, Modal, Popconfirm, QRCode } from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css';

const app = createApp(App)

app.use(ConfigProvider)
    .use(PageHeader)
    .use(Tabs)
    .use(Table)
    .use(Avatar)
    .use(Progress)
    .use(Tooltip)
    .use(Popover)
    .use(Button)
    .use(Input)
    .use(List)
    .use(Row)
    .use(Col)
    .use(Space)
    .use(Tag)
    .use(Typography)
    .use(Divider)
    .use(Modal)
    .use(Popconfirm)
    .use(QRCode)
    .mount('#app')
