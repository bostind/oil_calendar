const express = require('express');
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const schedule = require('node-schedule');
const { generateCalendar } = require('./utils/calendar');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// Python 后端服务的URL
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:5000';

// 中间件设置
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// 读取油价调整时间表
const getOilPriceData = () => {
    return JSON.parse(fs.readFileSync('tzrq.json', 'utf8'));
};

// 用户订阅数据存储
const subscribers = new Map();

// 首页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 管理界面路由
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 获取油价调整时间表和最新信息
app.get('/api/dates', (req, res) => {
    const data = getOilPriceData();
    res.json(data);
});

// 订阅日历
app.post('/api/subscribe', (req, res) => {
    const userId = Date.now().toString();
    const calendarUrl = `/api/calendar/${userId}`;
    subscribers.set(userId, {
        createdAt: new Date(),
        calendarUrl
    });
    res.json({ userId, calendarUrl });
});

// 生成日历
app.get('/api/calendar/:userId', (req, res) => {
    const { userId } = req.params;
    if (!subscribers.has(userId)) {
        return res.status(404).send('订阅不存在');
    }
    
    const data = getOilPriceData();
    const now = new Date();

    // 找到所有未来的调整日期
    let futureAdjustmentDates = [];
    // 确保 adjustmentDates 存在且是数组，然后进行排序
    if (data.adjustmentDates && Array.isArray(data.adjustmentDates)) {
        data.adjustmentDates.sort((a, b) => new Date(a.date) - new Date(b.date)); // 确保日期是升序的
        for (const dateEntry of data.adjustmentDates) {
            const adjustmentMoment = moment(dateEntry.date).endOf('day'); // 考虑到24:00，将日期视为当天结束

            // 比较日期，过滤掉已经过去的日期
            if (adjustmentMoment.isSameOrAfter(moment())) {
                futureAdjustmentDates.push(dateEntry); // 收集所有未来的调整日期
            }
        }
    }

    const calendar = generateCalendar(futureAdjustmentDates, { 
        lastUpdate: data.lastUpdate,
        lastTrend: data.lastTrend,
        lastAmount: data.lastAmount
    });
    
    res.set('Content-Type', 'text/calendar');
    res.set('Content-Disposition', `attachment; filename="oil-price-calendar.ics"`);
    res.send(calendar.toString());
});

// 获取订阅统计
app.get('/api/stats', (req, res) => {
    const data = getOilPriceData();
    res.json({
        subscriberCount: subscribers.size,
        dates: data.adjustmentDates,
        lastUpdate: data.lastUpdate,
        lastTrend: data.lastTrend,
        lastAmount: data.lastAmount,
        lastTypes: data.lastTypes,
        lastSource: data.lastSource,
        lastNews: data.lastNews,
        lastNewsUrl: data.lastNewsUrl
    });
});

// 更新油价趋势 (管理界面手动更新)
app.post('/api/update-trend', (req, res) => {
    const { date, trend } = req.body;
    let data = getOilPriceData();
    // 找到对应的日期并更新趋势
    const targetDate = data.adjustmentDates.find(d => d.date === date);
    if (targetDate) {
        targetDate.trend = trend; // 添加或更新趋势字段
    }
    data.lastUpdate = moment().format('YYYY-MM-DD'); // 假设手动更新也更新最新时间
    data.lastTrend = trend; // 更新最新趋势

    fs.writeFileSync('tzrq.json', JSON.stringify(data, null, 4));
    res.json({ success: true });
});

// 启动服务器
app.listen(port, () => {
    console.log(`Node.js 服务器运行在 http://localhost:${port}`);
    console.log(`Python 后端服务运行在 ${PYTHON_BACKEND_URL}`);
    
    // 设置每日自动触发Python后端爬虫
    schedule.scheduleJob('0 15 * * *', async () => {
        try {
            console.log('触发Python后端油价爬虫...');
            const response = await axios.get(`${PYTHON_BACKEND_URL}/fetch_oil_price`);
            if (response.data.status === 'success') {
                console.log('Python后端油价爬虫执行成功。');
            } else {
                console.error('Python后端油价爬虫执行失败:', response.data.message);
            }
        } catch (error) {
            console.error('调用Python后端油价爬虫失败:', error.message);
        }
    });
}); 